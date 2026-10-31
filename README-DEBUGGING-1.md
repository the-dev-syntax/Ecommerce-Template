don't add to skills [when you commit any code, use a brief and descriptive commit message that clearly explains the purpose of the changes made. Avoid generic messages like "fix" or "update" and instead provide context about what was changed, and push after the commit.]

GLM-1-DEBUGGING:
All four audits are done and I've personally re-verified the headline findings in the code (open redirect, Math.random OTP, plaintext seed password, COD expiresAt: undefined, raw updateSetting write, missing model indexes, dead /account/addresses link, plain next/link vs next-intl, formatError leak, unvalidated browsing-history API, client-controlled isVerifiedPurchase). Two items the agents cited slightly differently resolved the same way (the isVerifiedPurchase leak flows through ReviewInputSchema.parse({...data}), not a named field in the action).

### P0 — Critical (security / account takeover / data-loss)
1. Open redirect via callbackUrl
- app/[locale]/(auth)/sign-in/page.tsx:22-28 (redirect(callbackUrl) for logged-in users), sign-in/credentials-signin-form.tsx:54,79 (redirect(callbackUrl) after sign-in), sign-up/page.tsx:22; plus sign-up/signup-form.tsx:171 builds the link unencoded (/sign-in?callbackUrl=${callbackUrl}).
- Why: redirect() follows absolute URLs. A victim hitting /sign-in?callbackUrl=https://evil.example lands off-site after authenticating.
- Edit: add safeCallbackUrl() in lib/utils (cb?.startsWith('/') && !cb.startsWith('//') && !cb.includes('\\') ? cb : '/') and use it in all 3 places; encodeURIComponent in the signup link.
2. Google OAuth users are split from the Mongoose identity system + allowDangerousEmailAccountLinking: true
- auth.ts:37 uses MongoDBAdapter(clientPromise) while all user logic (updateUserEmail, orders Order.create({user}), verifyEmailOtp, browsing history) casts session.user.id to the Mongoose User. auth.ts:145's catch { token.role='user'; token.emailVerified=null } isn't fail-closed — it fabricates a session every DB write will reject. auth.ts:40 auto-links Google sign-in onto any same-email account → an attacker who registers the victim's email first (verification oracles below) takes over the account when the victim clicks "Continue with Google", and sees their orders.
- Edit: ensure a Mongoose user exists/bridged in the jwt/signIn callback (or drop the adapter and create Mongoose users from the Google profile); set allowDangerousEmailAccountLinking: false unless the existing account's email is verified.
3. Email change applies before verification, with no password re-auth
- user.actions.ts:526-559: updateUserEmail sets email = newEmail, emailVerified = null, and mails an OTP to the new address. A stolen 30-day JWT instantly moves the account to the attacker's mailbox (then password-reset completes takeover), and the user is locked out of /checkout//account until the OTP lands. Also verificationToken is shared by signup/resend/re-send (line 611, 671), so flows clobber each other, and .select('email') omits name (553).
- Edit: store pendingEmail + separate pendingEmailToken/expires; require currentPassword; swap atomically only in the verify step; notify the old address.
4. Email OTP generated with Math.random() and digit constraints; no per-account guess limit
- lib/utils.ts:270-292 (Math.floor(Math.random()*10), adjacent/repeat constraints shrink entropy); verifyEmailOtp (user.actions.ts:600-626) counts only IP attempts (rate-limit.ts), and IPs are forgeable (see 7).
- Edit: crypto.randomInt(0, 1_000_000).toString().padStart(6,'0'); add failedOtpAttempts on the user doc with lockout/clear after N failures.
5. Seed data: plaintext password in the collection + no hashing hook on UserSchema
- lib/data.ts:58 (a plaintext password for a real seed account — can never log in since bcrypt.compare(plain, plain) fails), and user.model.ts has no pre('save') hash, so any future direct .save() path stores plaintext. Seed credentials also sat in comments (data.ts:9-11).
- Edit: seed with a bcrypt hash; add pre('save') hashing (skip when already $2b$); remove plaintext comments.
6. Email enumeration oracles
- Registration "Email is already in use" (user.actions.ts:64-70), same message on email change (526-530), and "Email is already verified" on resend (662-666) — while password reset deliberately uses neutral wording.
- Edit: uniform success responses; send an informational email instead of an error.
7. All auth rate-limiters key on a forgeable X-Forwarded-For
- lib/rate-limit.ts:127-140 — first XFF entry, else unknown:${user-agent} (a shared bucket an attacker uses to lock out/observe). Defeats sign-in/reset/OTP limits on non-JSUDX hosts.
- Edit: trust the platform header (x-real-ip/cf-connecting-ip), fail closed (500) when no trusted IP exists instead of the UA fallback.
8. npm run seed is destructive with no environment guard
- lib/db/seed.ts:26-75 runs deleteMany() on settings/pages/users/products/reviews/orders. Nothing blocks production.
- Edit: refuse unless NODE_ENV !== 'production' or --force.


### P1 — High (money, stock, order integrity)
9. COD stock reservations never expire
- lib/orders/stock-reservations.ts:158-161 sets expiresAt: undefined for COD; releaseExpiredReservations (254-257) matches only a past expiresAt. Abandoned COD checkouts lock inventory forever.
- Edit: give COD a long TTL (24-72 h) and/or auto-cancel its unpaid order after grace.
10. Expiry sweep can race a concurrent payment → phantom stock (oversell)
- Sweep flips held→released without checking order.isPaid; a paying customer in fulfillOrder (fulfill-order.ts:105-157) then sees holdsStock=false and decrements stock a second time while the sweep restocks. Sweep runs inside every createOrder (order.actions.ts:352), so concurrency is realistic. (Suspected — concurrency-triggered, logic confirmed by code path.)
- Edit: inside the release transaction join Order and refuse to release when isPaid; move the sweep out of the createOrder hot path to the cron route; create order + reservation in one transaction.
11. Charged-but-unfulfillable: 30-min reservation TTL vs. time on payment page, no compensation
- createStripePaymentIntent (order.actions.ts:703-765) doesn't bump TTL. After expiry the reservation is released; if stock is gone at payment, fulfillOrder throws "Not enough stock", the webhook 500s and Stripe retries forever — the card was charged, the order stays unpaid, no auto-refund.
- Edit: bump expiresAt when creating the intent/PayPal order; on fulfill-failure-due-to-stock, auto-cancel + gateway-refund, keep the event failed.
12. createOrder has no idempotency — duplicate orders from back-navigation
- checkout-form.tsx:201-244: guard flag only covers one button in one tab; cart clears only on payment success (payment-form.tsx:48-52 etc.), so Back → "Place Your Order" creates a second order and reservation.
- Edit: persist a cartId in the Zustand store; server-side, return the existing pending_payment order for the same fingerprint instead of inserting a new one.
13. No-rate-coverage addresses silently fall back to stale settings pricing and drop the COD fee
- order.actions.ts:297-306, 852-878: when getShippingRates returns [] (address outside every zone), checkout quotes the seed settingDeliveryDates (free-over-limit) and codFee = 0 — contradicting README-SHIPPING; also codAvailable (shipping-rate.model:49) is never enforced.
- Edit: if an address is set and there are no active rates while rates are configured, throw "Shipping is not available for this address" (or explicit noCoverage state); enforce codAvailable === false → reject COD; source fallback COD fee from settings otherwise.
14. updateSetting writes the raw payload — no zod validation; settings cache goes stale cross-instance
- setting.actions.ts:64-69: Setting.findOneAndUpdate({}, newSetting, ...) bypasses SettingInputSchema; models' defaults mask bad data (this is the setting that drives tax/free-shipping money). globalForSettings.cachedSettings is per-process, so on multi-instance deploys other pods serve old tax/shipping settings until restart.
- Edit: SettingInputSchema.parse(newSetting) before write; revalidate via revalidateTag/versioned cache or short TTL on getSetting.
15. Moyasar dashboard refunds never restock or update line refundedQuantity
- app/api/webhooks/moyasar/route.ts:113-201 syncs refundedAmount/credit note only — stock stays decremented and the order UI shows a refunded order with no refunded lines (admin cancelOrderById does restock — divergent behavior for the same event).
- Edit: on full refund, reuse the cancel restock pipeline under the idempotency of the recorded refund delta.
16. formatError returns raw error.message to clients
- lib/utils.ts:108-113 — leaks Mongoose "Cast to ObjectId failed…", gateway error bodies, zod internals.
- Edit: keep zod/11000 branches; return 'Something went wrong' + console.error otherwise.
17. "Verified Purchase" badge is fully client-controlled
- validator.ts:26 (isVerifiedPurchase: z.boolean()), form hard-codes it true (review-list.tsx:153), action passes it through (review.actions.ts:33-36); no purchase check. Badge is meaningless and spoofable by direct action call.
- Edit: compute server-side — Order.exists({ user: session.user.id, isPaid: true, 'items.product': productId }).
18. Missing indexes on hot paths + duplicate shipping quotes
- order.model.ts has no { user: 1, createdAt: -1 } / { createdAt: -1 } (user orders list + admin summaries — confirmed by model grep); review.model.ts has no product index; shipping-rate (region, city, isActive, priority) is non-unique and upsertShippingRate (shipping.actions.ts:19-37) doesn't dedupe → two identical rows produce duplicate quotes and ambiguous deliveryDateIndex.
- Edit: add the two indexes; add review {product:1, createdAt:-1}; make shipping-rate unique on (country, region, city, carrier, serviceName) + pre-check in upsert.


### P2 — Medium (public 500s, i18n, checkout UX)
19. Search page 500s on any unknown ?sort= — product-sort-selector.tsx:43 does sortOrders.find(...)! while getAllProducts accepts unknown values (product.actions.ts:175-184). Edit: whitelist sort server-side and ?.name ?? t('Best selling').
20. Unknown/unpublished product slug → 500 instead of 404 — getProductBySlug throws (product.actions.ts:69-74), page has no try/notFound() (product/[slug]/page.tsx:29-59; the if (!product) check is dead code). Edit: action returns null → notFound() in page + metadata (same for robots: it currently gets a 500 for stale URLs).
21. /page/[slug] 404 branch is unreachable — web-page.actions.ts:64-71 throws; if (!webPage) notFound() at page/[slug]/page.tsx:38 never runs; unpublished/typo'd page → 500. Same fix as 20.
22. Systemic locale-drop on guest navigation — next-intl runs with localePrefix: 'as-needed' and exports i18n-aware Link/useRouter (i18n/routing.ts:15), but nearly every storefront component uses plain next/link/next/navigation: product-card.tsx:35,63,151 (all product tiles), header search.tsx:22 (<form action='/search'>), sidebar.tsx, cart-button.tsx, menu-links.tsx, footer.tsx, home-card.tsx, cart page links (/, /cart), add-to-cart.tsx:47,106 (router.push('/cart'|'/checkout')), checkout/page.tsx redirect. Anyone browsing /fr or /ar is silently dumped back into English (and LTR) mid-journey. Edit: sweep to @/i18n/routing imports (footer already imports them correctly); special-case the header search form with the locale-aware router or /${locale}/search.
23. Language switch keeps neither query nor filters — language-switcher.tsx:55-59 (href={pathname}; next-intl pathname excludes search params) and footer.tsx:97-99 (router.push(pathname,{locale})). Switching locale drops ?q=, filters, and the chosen variant/size/color. Edit: pass params alongside pathname (i18n Link accepts them) or append searchParams.
24. Middleware locale detection is prefix-unsafe + garbage paths → sign-in instead of 404 — middleware.ts:31 startsWith('/fr') matches /friends-page, /archives...; then guests hitting any non-public/typo path get redirected to /sign-in?callbackUrl=... (crawl-budget + odd UX; [locale] layout's notFound() only runs after the excursion). Edit: anchor the locale match (/(en-US|ar|fr)(?=\/|$)/ or parsed first segment) and pass unmatched top-level routes through to intlMiddleware so they 404.
25. Default-locale (en-US) auth redirects use a prefixed URL — middleware.ts:52-58 builds /en-US/sign-in?... but localePrefix:'as-needed' immediately 308s it back to /sign-in?... (needless hop, fragile param preservation; same for the email-verify redirect and the checkout/account redirect in middleware.ts:65-74). Edit: omit the prefix when locale === routing.defaultLocale (pattern already used for the admin redirect).
26. Email-verification gate matches by substring and misses /invoice — middleware.ts:72-78 pathname.includes('/checkout') etc. /invoice/[id] is auth-guarded but not verification-gated (an unverified user can open tax invoices while blocked from /account/orders). Edit: locale-strip then prefix-match the route list; add /invoice.
27. Fire-and-forget cart writes + no server sync at checkout — checkout-form.tsx:171-174 calls the async setShippingAddress(values) without await/catch then advances the step; setShippingAddress throws in calcDeliveryDateAndPrice → buildOrderItems ("Product is no longer available", order.actions.ts:96-98) when a cart product was unpublished, so the address is never saved, and the error surfaces only later as "shippingAddress: Required" at place-order. Same pattern in cart page/qty selectors and cart-sidebar.tsx:88-109. Additionally refreshCart() runs only on /cart, so /checkout shows prices/stocs from a stale localStorage cart until place-order. Edit: await + try/catch + toast, don't advance on failure; prune unavailable items; call refreshCart() on checkout mount.
28. Product with zero images 500s the detail page — product-gallery.tsx:37 next/image src={images[selectedImage]} with images=[] throws "Invalid src". Edit: empty-state guard + schema validation (published products need ≥1 image).
29. Dead "Addresses" card on the account hub — account/page.tsx:58 links to /account/addresses, which doesn't exist (no address-book feature anywhere). Guests/customers hit a 404 from their own account page; every checkout re-types an address. Edit: implement saved addresses (User.addresses[] + actions) or remove the card now.
30. Public recommendations API is unvalidated — app/api/products/browsing-history/route.ts:16-45: ids/categories split raw into _id: {$in} (CastError → 500, unbounded $in, whitespace breaks matching), returns full product docs (skus, tax fields), ignores the features.browsingHistory flag. The client (browsing-history-list.tsx:59-63) also sends unencoded comma-joined params (breaks on ,, &, %). Edit: validate/cap (24-hex, ≤50), project card fields, honor the feature flag; build the client URL with URLSearchParams; gate the list on useIsMounted() (hydration mismatch).
31. Currency SSR flash + inconsistent currency switchers — use-setting-store initializes with SAR defaults; the cookie currency reaches the store only post-hydration (settings-initializer.tsx:16-18), so every server-rendered price paints seed-currency then flips (layout shift). Header persists the choice via cookie (setCurrencyOnServer), the footer mutates only the transient client store (lost on reload). Edit: hydrate the store synchronously from the SSR-provided setting; route footer changes through setCurrencyOnServer.
32. Home-page banners link the wrong "tag" and unencoded categories — app/[locale]/(home)/page.tsx:62,73-89 sends Best Sellers/Featured to ?tag=new-arrival; category tiles build /search?category=${category} unencoded (breaks on &/spaces) in home page and sidebar.tsx:84. Edit: correct tags; use encodeURIComponent/getFilterUrl.
33. No rate limits on heavy public actions — calcDeliveryDateAndPrice (product fetch + shipping query on every cart mutation), getAllProducts, setCurrencyOnServer. The limiter infra exists but is wired only for auth. Edit: per-IP buckets + short-TTL cache of active shipping rates.
34. sitemap/robots read different env vars — app/sitemap.ts:12 NEXT_PUBLIC_SITE_URL vs app/robots.ts:5 NEXT_PUBLIC_SERVER_URL → one can point at localhost. Edit: single source of truth.



### P3 — Low / hygiene / suspected (needs runtime confirmation)
- 35. Non-variant products always weight: 0 (order.actions.ts:179, no product-level weight field) → extraPerKg surcharges never apply. Add product/parcel default weight.
- 36. ShippingAddressSchema is length-only (phone: "x" passes; validator.ts:150-181); ShippingRateSchema allows etaMinDays > etaMaxDays (add .refine) and unbounded freeShippingMinPrice.
- 37. Timezone mismatches: getOrderSummary groups $dateToString (UTC) over server-local month start (order.actions.ts:994-999); parseDateParam (local) vs VAT report's UTC parsing — one-day bucket slippage. Standardize on UTC.
- 38. registerUser sends the verification email before the per-email limiter check (user.actions.ts:72-92) — flood/UX.
- 39. Duplicate React keys in the order items table (order-details-form.tsx:175 uses item.slug — same product, two variants).
- 40. Checkout state machine edges (suspected): "Change address" force-opens later steps; payment radio can display a persisted method that is disabled now; deliveryDateIndex ?? 0 at place-order vs last-option default in calc; stale deliveryDateIndex after a rate change maps to a different quote. Reset index from the resolved calc result when quote lists change.
- 41. Cart store last-write-wins (suspected): rapid quantity + delivery-speed changes interleave and the loser overwrites the winner (use-cart-store.ts mutators). Serialize results or validate-guard with calc-in-flight flags.
- 42. Variant substitution is silent (suspected): legacy carts without variantId get re-matched (default variant → variants0); payment page can show a different variantLabel with no warning.
- 43. Shared-device cart leakage: single global EV-cart localStorage key; a JWT-expired session hands the next user the previous cart incl. name/street/phone. Scope by user or clear on user-id change.
- 44. Stripe legacy charge.succeeded path compares charge.amount (fails safe but blocks odd capture flows); subscribe to payment_intent.succeeded only.
- 45. useSearchParams in checkout/[id]/*-payment-success clients without a <Suspense> boundary (currently shielded by dynamic parents — verify at build).
- 46. Dead/confusing code: commission payment setting unused (settings model + admin form); commitStockReservation never called; init on the cart store untyped/unused; unreachable "No product found" block in search; results t shadowed in the tags map; HomeCarousel t(item.title) requires admin strings to be message keys (use t.has(...)).
- 47. Reviews publish without moderation (no isApproved field) — policy decision needed.
- 48. Edge JWT never rechecks role/tokenVersion (only the Redis list, fail-open when Redis is down — session-revocation.ts:96-118); per-device revocation silently degrades during a Redis outage. Add a Mongo RevokedSession TTL row checked in the node jwt callback.
Verified clean (negative results, worth knowing)
- No IDOR found: getOrderById, all PayPal/Stripe/Moyasar mark-paid paths enforce isAdminOrOwner; admin actions use requireAdmin; dbOrderWith3UserKeys correctly un-exported.
- Webhooks are authentic and idempotent: Stripe signature verification with raw body; Moyasar constant-time token + gateway re-fetch + amount/currency checks; PaymentEvent unique (provider,eventId) + transactional isPaid guard; client-supplied isPaid/prices/shippingPrice are stripped by createOrderFromCart (everything recomputed from DB).
- Stock decrement guarded (countInStock: {$gte}) inside a transaction; failed reservation deletes the order.
- No Mongo operator injection ($where absent, regexes escaped); public queries filter isPublished: true consistently (products, related, sitemap, home sliders).
- Middleware public/protected split is correct for the real routes; cart survives the sign-in round-trip (persisted store).
Suggested fix order
1. P0 1, 2, 3, 4, 8, 16 (account security + leak) → then 5, 6, 7.
2. P1 9, 10, 11, 12 (stock/money race cluster) → 13, 14, 15, 17, 18.
3. P2 19-24 (500s + the i18n Link sweep) → 25-32 → 33, 34.
4. P3 in one hygiene pass (validators, dates, dead code, suspected race guards).

--------------------------
>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
# SECOND AUDIT
>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
## Full-site audit - 2026-10-31 (HEAD `80bc3f4`, production `www.essentialvital.com`)

Scope: every route, server action, model and background job, plus a live smoke test of the deployed build. Method: `npx tsc --noEmit`, `npm run lint`, `npm test` (105 passing), `npm run i18n:check` (805 keys in en-US/ar/fr), live `curl` checks against production, and four parallel code reviews (auth/security, orders/payments, cart/checkout, catalog/UI/i18n). Only issues reproduced in code or on the live site are listed. The 48 items above are not repeated; fixed ones are omitted.

Legend: **[live]** reproduced on production; **[code]** proven by reading the current code; **[staging]** needs gateway/DB access to reproduce.

### P0 - Critical

49. Seed dataset and bcrypt hashes are shipped to every browser - [live]
- `hooks/use-setting-store.ts:2` imports the whole default export of `lib/data.ts` (`export default data`), which contains `users` with pre-hashed passwords plus emails, phones and addresses. The store is imported by client components, so the dataset is bundled.
- Live: `/_next/static/chunks/1911-a790167c4fa61bfa.js` contains **4 bcrypt hashes** and **16 `@example.com` addresses**, including `admin@example.com`, `jane@example.com` and `jack@example.com`.
- Impact: password hashes and customer PII are public in the JS bundle. The live catalogue matches the dev seed, so if the seeded admin account exists in production, the documented seed password is an admin-takeover path. It also inflates every page's JS.
- Fix: export a minimal client-safe `defaultSettings` from a separate module; never import `lib/data.ts` from client code. Rotate the seeded account passwords and confirm no demo admin exists in production.

### P1 - High

50. Transactional email links use the stale `ev-web-zeta.vercel.app` origin - [live]
- `emails/index.tsx:24` (`siteUrl: site.url`), `lib/actions/user.actions.ts:267-271` (password-reset link built from `site.url`) and `emails/purchase-receipt.tsx:75` all use the DB setting, whose seeded/live value is `https://ev-web-zeta.vercel.app/` (`lib/data.ts:1617`). The canonical origin is `https://www.essentialvital.com`.
- Live: the product page emits `twitter:image = https://ev-web-zeta.vercel.app//og-preview.jpg`, and `https://ev-web-zeta.vercel.app/invoice/<id>` redirects to `/sign-in` because the session cookie belongs to the canonical host.
- Impact: verification, password-reset, receipt and invoice links send customers to the alias host; sessions do not carry over, so invoice links bounce to sign-in. Some templates also produce `//path` because `siteUrl` keeps its trailing slash.
- Fix: build every email link with `getSiteUrl()` (already strips trailing slashes) and update `settings.site.url` to the canonical domain.
- **Fixed 2026-10-31:** all email links now use `getSiteUrl()`; `settings.site.url` is display-only, both defaults and the live document are canonical, and `tests/email-links.test.ts` guards the change.

51. Moyasar webhook silently discards a captured payment for a cancelled or already-paid order - [code]
- `app/api/webhooks/moyasar/route.ts:215-217` returns `ignored` when `order.isCancelled` or `order.isPaid` without comparing `payment.id` with `order.moyasarPaymentId`, refunding, or alerting.
- Failure: a customer completes 3DS while an admin cancels the unpaid order; the capture lands, the webhook returns 200/ignored, stock is already released and nothing refunds the card. Two checkout tabs create two Moyasar payments: the second capture is dropped while the customer is charged twice. A later dashboard refund then hits `Refund received before the order was paid` (`route.ts:115-117`) and 500s forever.
- Fix: on a paid capture that does not match the recorded payment, or on a closed order, call `recoverCapturedPayment`/refund or move to `manual_review`; never acknowledge and drop the money.
- **Fixed 2026-10-31:** cancelled-order captures go through `recoverCapturedPayment`; a second capture on a paid order is refunded and logged without touching the paid state; failures set `isDisputed` and return 500 for retry. `tests/moyasar-capture.test.ts` covers the payment-id and refundable-amount helpers.

52. Cancelling a dashboard-refunded order restocks the same units twice - [code]
- `lib/orders/refund-order.ts:582-628` increments stock by `item.quantity` and only afterwards stamps `restockedQuantity`; it ignores the value already written by `restockFullyRefundedOrder` (`:813-836`). The Moyasar refund webhook restocks but does not set `isCancelled` (`route.ts:141-179`), so the admin cancel button stays available.
- Impact: phantom inventory, oversell later, and `numSales` decremented twice.
- Fix: in the cancel loop restock only `item.quantity - (item.restockedQuantity ?? 0)` and claim each line atomically, as the refund helper does.
- **Fixed 2026-10-31:** both cancellation and dashboard-refund restocking use `remainingRestockQuantity` and the same atomic `restockedQuantity` claim; cancelling after a dashboard refund now adds zero stock. `tests/restock.test.ts` covers the quantity rule.

53. PayPal capture is not durably recorded; a retry can charge twice - [code]
- `lib/actions/order.actions.ts:590-597` overwrites `paymentResult.id` with every new PayPal order, and `:641-659` captures before anything is persisted. There is no PayPal webhook (absent from `app/api/webhooks/payments/[provider]/route.ts`) and `approvePayPalOrder` does not reconcile `ORDER_ALREADY_CAPTURED`.
- Failure: PayPal captures the money, `fulfillOrder` then fails (DB blip/timeout) and the action returns an error while the order stays unpaid. The customer retries, a second PayPal order is created and overwrites the first id, and the second capture fulfils the order. The first charge is invisible to the app.
- Fix: persist the PayPal order id before capture and refuse to create a new one while it exists; on failure, fetch the capture with `paypal.getOrder` and fulfil/recover; add a capture webhook or reconciliation cron.
- **Fixed 2026-10-31:** the order stores `paypalOrderId`/`paypalCaptureId`; `createPayPalOrder` reuses the stored order, and `approvePayPalOrder` reconciles `ORDER_ALREADY_CAPTURED` and records the capture before fulfillment. `tests/paypal-capture.test.ts` covers the helpers.

54. ZATCA transient failures are marked `failed` and never retried automatically - [code]
- `lib/zatca/service.ts:235-240` sets `status = 'failed'` and returns `retryable: true`, but `processZatcaQueue` only scans `queued`/`pending` (`:275-278`). The invoice page only queues when no submission exists (`app/[locale]/invoice/[id]/page.tsx:44-50`), so a `failed` row is never re-queued.
- Impact: a ZATCA outage or temporary credential error leaves a tax invoice/credit note unreported past the legal window unless an admin opens that exact order and clicks retry.
- Fix: keep retryable failures scannable (stay queued/pending with an error, or scan `failed` with backoff and an attempt cap) and re-queue from the invoice page.
- **Fixed 2026-10-31:** retryable failures stay `pending` with backoff/`nextAttemptAt` and become terminal only after six attempts; the queue also picks up legacy `failed` rows below the cap. Added `/api/cron/zatca` and `tests/zatca-retry.test.ts`.

55. Every page declares the locale homepage as its canonical and inherits its Open Graph data - [live]
- `app/[locale]/layout.tsx:67-74` sets `alternates.canonical = /${locale}`, `:76-94` sets `openGraph.url = '/'` plus a default image, and `:104` sets the Twitter image. Product/search/page `generateMetadata` return only `title`/`description` (`app/[locale]/(root)/product/[slug]/page.tsx:28-40`), so the layout values win.
- Live: `/fr/product/essential-vital-gift-card` returns `<link rel="canonical" href="https://www.essentialvital.com/fr">`, `og:url` = site root, `og:title` = the site slogan, and the same `og:image` for every product.
- Impact: Google is told every product, search and info page canonicalises to the locale homepage, so product URLs can be dropped or consolidated; shared product links show the generic slogan.
- Fix: keep only the title template/description in the root layout; emit self-referencing canonical, `openGraph.url`, `openGraph.images` and `twitter` in each route's `generateMetadata` using `getSiteUrl()` and the current path.
- **Fixed 2026-10-31:** added `buildPageMetadata` (`lib/seo.ts`) and wired it into home, search, product and web-page routes; the layout no longer sets a canonical or `openGraph.url`. Verified on Preview for `/`, `/search`, `/product/...` and `/fr/product/...`.

56. `og-preview.jpg` does not exist, so every social preview image is a 404 - [live]
- `app/[locale]/layout.tsx:46` defaults `ogImage` to `/og-preview.jpg`, and `public/` does not contain that file (live `GET /og-preview.jpg` returns 404).
- Impact: WhatsApp, X, Facebook and LinkedIn previews show a broken image on every page.
- Fix: add a real 1200x630 image at `public/og-preview.jpg`, or use `app/opengraph-image.tsx` and stop overriding `images` with a missing path.
- **Fixed 2026-10-31:** the default now resolves to the generated `app/opengraph-image.png` (200) and the legacy setting is mapped to it; `/og-preview.jpg` is no longer referenced by new builds.
- **Fixed 2026-11-01:** `/og-preview.jpg` now 308-redirects to `/opengraph-image.png` for cached or external links.

### P2 - Medium

57. Sitemap emits double-slash URLs for the default locale - [live]
- `app/sitemap.ts:23,34,43` builds `${siteUrl}/${locale === 'en-US' ? '' : locale}${path}` while `path` already starts with `/`.
- Live: `sitemap.xml` contains **44** `<loc>https://www.essentialvital.com//...</loc>` entries (29 products plus `/search`, `/cart` and pages). Each one 308-redirects to the correct URL.
- Fix: use `${siteUrl}${locale === 'en-US' ? '' : `/${locale}`}${path}` and assert no `//` after the origin.
- **Fixed 2026-11-01:** the sitemap now uses `localizedPath()`; Preview `sitemap.xml` has zero `//` URLs.

58. Pagination on `/fr` and `/ar` navigates to `/fr/fr/...` and 404s - [live]
- `components/shared/pagination.tsx:25` calls `formUrlQuery`, which uses `window.location.pathname` (`lib/utils.ts:237`) - that path already contains `/fr`. The result is pushed through the locale-aware router, which prefixes the locale again.
- Live: `/fr/fr/search?page=2` returns 404 while `/fr/search?page=2` returns 200. The same component is used by `/account/orders`, `/admin/orders`, `/admin/reviews` and `/admin/users`.
- Fix: base the query URL on `usePathname()` from `@/i18n/routing` (locale-stripped), not `window.location.pathname`.
- **Fixed 2026-11-01:** `formUrlQuery` accepts `basePath` and Pagination passes the locale-stripped `usePathname()`; a router prefix is now added once. `tests/pagination-url.test.ts` guards it.

59. Missing product/page slugs render the 404 UI but return HTTP 200 (soft 404) - [live]
- `app/[locale]/(root)/product/[slug]/page.tsx:62` and `app/[locale]/(root)/page/[slug]/page.tsx:38` call `notFound()`, but the route streams first through `app/[locale]/loading.tsx:3`, so the status is committed before the 404 boundary resolves.
- Live: `/product/does-not-exist-xyz` and `/page/does-not-exist-xyz` both return 200 with `NEXT_HTTP_ERROR_FALLBACK;404` in the body. The status is 200 even though a `noindex` meta is injected.
- Impact: stale/typo'd links are indexed as valid pages, analytics and uptime monitors see no error, and crawl budget is wasted.
- Fix: resolve the slug in `generateMetadata` (awaited before the shell flushes) and call `notFound()` there too, or scope/remove the locale loading boundary for these routes; verify with `curl -o /dev/null -w '%{http_code}'` (must be 404).
- **Fixed 2026-11-01:** removed the global locale loading boundary (streaming committed 200 first), scoped `PageLoading` to home/search/cart/account/admin/checkout, and added `notFound()` to product/web-page metadata. Preview now returns 404 for missing slugs and 200 for valid pages.

60. Search filters keep the current `page`, so filtering from page 2+ shows an empty grid - [live]
- `app/[locale]/(root)/search/page.tsx:99` passes `params` (including `page`) into `getFilterUrl` (`lib/utils.ts:267-274`), which preserves it.
- Live: `/search?category=T-Shirts&page=2` displays "10 - 9 of 6" and zero product links; clicking any category/tag/price filter from page 2 produces the same shape.
- Fix: delete/reset `page` inside `getFilterUrl` whenever any other filter or sort changes; clamp out-of-range pages server-side.
- **Fixed 2026-11-01:** filters and sort reset `page`, and the search page clamps an out-of-range page to the last page. `/search?category=T-Shirts&page=2` now renders `1 - 6 of 6` with products; `tests/filter-url.test.ts` covers the URL rule.

61. A verified user can never finish an email change (the OTP screen redirects away) - [code]
- `updateUserEmail` stores `pendingEmail` but leaves `emailVerified` true (`lib/actions/user.actions.ts:600-621`); the form then pushes `/verify-email` (`app/[locale]/(root)/account/manage/email/email-form.tsx:64`). That page immediately redirects any verified session home (`app/[locale]/verify-email/page.tsx:23-25`), and `/account` is already gated to verified users in middleware.
- Impact: every user allowed to start an email change is bounced away before the OTP form renders. The address is never swapped, `pendingEmail` stays forever, and resend keeps mailing the stale address.
- Fix: only redirect when there is no valid pending email; render the OTP form for verified users with a pending change, or add a dedicated `/account/manage/email/verify` route outside the verification gate.
- **Fixed 2026-11-01:** `/verify-email` checks `pendingEmail`/`pendingEmailExpires` and keeps the OTP form open for a valid pending change. `tests/email-change.test.ts` covers the rule.

62. The COD fee is missing from the displayed checkout total on a first-time cart - [code]
- The cart store starts with `paymentMethod: undefined` (`hooks/use-cart-store.ts:18`), so `calcDeliveryDateAndPrice` adds no COD fee (`lib/actions/order.actions.ts:451-452`). Checkout resolves the fallback method for display but writes it back only when a method was already stored (`app/[locale]/checkout/checkout-form.tsx:288-294`), and the radio does not fire when it is already default. The summary renders the store's `codFee`/`totalPrice`.
- Impact: if COD is the first/default enabled method, the customer reviews `items + shipping`, while `handlePlaceOrder` submits COD and the server adds `+ codFee`; the payment page then shows a higher total.
- Fix: price the cart for the method that will actually be submitted (write the resolved fallback on mount, or resolve the default inside `calcDeliveryDateAndPrice`), and use `settings.defaultPaymentMethod` instead of `enabledPaymentMethods[0]`.
- **Fixed 2026-11-01:** checkout writes the resolved default method to the cart on mount (including first-time carts), and `resolveDefaultPaymentMethod` prefers the configured default. `tests/payment-default.test.ts` covers the selection.

63. The order dedupe window is shorter than the stock hold, so one cart can produce two payable orders - [code]
- `lib/actions/order.actions.ts:516` only reuses a pending order created in the last **30 minutes**, while `RESERVATION_TTL_MS` is **60 minutes** (`lib/orders/stock-reservations.ts:16`) and creating a Stripe/PayPal order extends it.
- Failure: place O1 at t=0, open the payment page (hold extends to ~60 min), return to checkout at t=35 and submit again: O2 is created with a second reservation. Both are `pending_payment` and independently payable, and the customer can pay both.
- Fix: make the dedupe lifetime at least the reservation TTL and enforce it with a unique partial index on `{ user, cartFingerprint }` for open orders; reuse/extend the existing order instead of inserting.
- **Fixed 2026-11-01:** the dedupe query uses `RESERVATION_TTL_MS` (60 minutes), matching the stock hold. A unique partial index remains a future hardening step.

64. Moyasar refund is issued before the durable claim, so a retry is rejected forever - [code]
- `lib/orders/refund-order.ts:150-190` calls the gateway before the transaction at `:193-250`; the idempotency record (`OrderReturn`) is only created inside that transaction, and `isMoyasarRefundable` accepts only `paid`/`captured` after the refund.
- Failure: the gateway refund succeeds, then the transaction aborts (timeout/contention). The order still shows `refundedAmount = 0`, no return, no stock, no credit note. Retrying fails with "Payment cannot be refunded (status: refunded)", so the operator cannot reconcile without paying twice manually.
- Fix: create the idempotent claim/`OrderReturn` before the gateway call, then finalize; on retry, if the gateway already reports the refund, complete the local transaction from that state.
- **Fixed 2026-11-01:** a retry checks the gateway refunded amount first and finalizes from it when the requested refund already exists; concurrent gateway attempts are reconciled by re-fetching the payment. `tests/refund-state.test.ts` covers the rule.

65. Refunded orders can still be shipped and delivered - [code]
- `shipOrder` (`lib/actions/order.actions.ts:1604-1606`) and `deliverOrder` (`:1668-1673`) check `isCancelled`, `isPaid` and `isDelivered` but not `status === 'refunded'` or `refundedAmount`. The Moyasar refund webhook sets `status: 'refunded'` without `isCancelled`.
- Impact: the admin page still offers "Ship order" after a full dashboard refund; clicking it overwrites `refunded` with `shipped` and emails a shipping notice to a refunded customer.
- Fix: treat `refunded`/full `refundedAmount` as terminal and hide the ship/deliver controls.
- **Fixed 2026-11-01:** `isFullyRefunded()` guards both actions and the admin UI hides ship/deliver for fully refunded orders. `tests/refund-status.test.ts` covers the rule.

66. Admin revenue and sales charts include unpaid, cancelled and refunded orders - [code]
- `lib/actions/order.actions.ts:1229-1246` (`totalSales`), `:1252-1281` (`monthlySales`) and `:1311-1346` (`salesChartData`) match only on `createdAt` and sum `totalPrice`; there is no `isPaid` filter and no subtraction of `refundedAmount`.
- Impact: abandoned orders inflate revenue, and a full refund changes neither the dashboard card nor the charts, so they disagree with the VAT report (which nets credit notes).
- Fix: filter `isPaid: true`, exclude cancelled, and net out `refundedAmount` or aggregate invoices minus credit notes.

67. Editing a web page title silently rewrites its slug and breaks live URLs - [code]
- `app/[locale]/admin/web-pages/web-page-form.tsx:99-109` auto-generates the slug whenever `currentSlug === slugify(currentSlug)`, which is true for every valid slug, including an existing manual one.
- Failure: rename "About Us" to "About Essential Vital" and the slug silently becomes `about-essential-vital`; saving makes the linked `/page/about-us` a 404.
- Fix: generate the slug only on create and only while the field is untouched (track a `slugDirty` flag), or keep a redirect from the old slug.

68. Product tags cannot be set in the admin UI, so new products never appear in home sections - [code]
- `app/[locale]/admin/products/CreateProduct.tsx:32-37` defaults `tags: []` and `product-form.tsx` has no field bound to `tags` (grep returns no `tags` input), even though the homepage queries `tags` and the deal badge reads `todays-deal`.
- Impact: every product created in the admin UI is invisible to New Arrivals, Best Sellers, Featured, Today's Deals and tag filters, with no UI hint why.
- Fix: add a tags multi-select (allowed set `new-arrival`, `best-seller`, `featured`, `todays-deal`) and default new products to `['new-arrival']`.

69. An unknown payment-method name is treated as enabled but has no payment panel - [code]
- `lib/payments/index.ts:82-89` returns `true` for a method whose provider is unknown, so both the checkout list and `createOrderFromCart` accept it. `app/[locale]/checkout/[id]/payment-panel.tsx:149-151` renders nothing for unknown providers, and `updateOrderToPaid` only supports COD.
- Failure: an admin types "Mada" or "Cash On Deliver" in Settings; customers can select it, the order is created and stock reserved, but the payment page has no controls and no admin "mark paid" path.
- Fix: treat unmapped methods as disabled, validate `availablePaymentMethods` against provider ids, or add an explicit offline/manual panel plus admin mark-paid.

70. Registration and email change still reveal whether an address is registered - [code]
- `registerUser` returns different messages/shapes for existing vs new addresses (`lib/actions/user.actions.ts:101-104` vs `:127-128`). `updateUserEmail` returns success without `data` for a taken address (`:589-596`) but success with `{ email }` for a free one (`:625-630`), and the taken branch returns before the rate limiter (`:598`), adding a second oracle.
- Impact: server actions are callable endpoints, so an attacker can enumerate accounts for phishing/credential stuffing even though the UI hides the message.
- Fix: return an identical object (same message, no `data`) on both paths and run the limiter before the early return.

71. The email-verification gate exists only in middleware, so unverified accounts can call data actions directly - [code]
- `middleware.ts:26-28,89-103` is the only check of `emailVerified`; `createOrder`/`createOrderFromCart` (`lib/actions/order.actions.ts:291-302,314-320`) and `getMyOrders` (`:1177-1180`) check only the session id.
- Impact: an account that registered with an address it does not own can still POST the action from a public page and create orders/receive order data, because middleware only sees the page URL.
- Fix: add a `requireVerifiedUser(session)` check inside every data-touching action; keep middleware for UX only.

72. Toggling a shipping rate does not clear the 60-second quote cache - [code]
- `lib/actions/shipping.actions.ts:76-83` updates `isActive` but does not call `clearShippingRatesCache()` (unlike create/delete at `:53`/`:67`). `getActiveShippingRates` caches for `60_000` ms (`lib/shipping/rates.ts:8`), and order creation validates from that same list.
- Impact: a deactivated service is still quoted and orderable for up to a minute per instance; a newly activated one stays hidden.
- Fix: call `clearShippingRatesCache()` in `toggleShippingRate` and re-check `isActive` when creating the order.

73. The Stripe button shows the display-currency converted amount, not the charged currency - [code]
- `app/[locale]/checkout/[id]/stripe-form.tsx:74` renders `<ProductPrice price={priceInCents / 100} plain />`; `ProductPrice` converts to the visitor's display currency by default, while the Stripe intent is created in `order.currency`.
- Impact: a visitor displaying USD sees "$26.67" while Stripe charges 100.00 SAR, and the displayed figure drifts if the conversion rate is edited.
- Fix: pass `convert={false} currencyCode={order.currency}` as the other checkout surfaces do.

74. Checkout pre-fills the previous cart owner's name, street and phone before the cart is cleared - [code]
- `app/[locale]/checkout/checkout-form.tsx:199` seeds the form from the persisted `shippingAddress`; the owner is claimed only in a post-mount effect (`:281`), and `setCartOwner` clears only when a different owner is already stored (`hooks/use-cart-store.ts:189-200`). The form-sync effect bails once the address is cleared (`:249`), so the already-rendered values remain.
- Impact: on a shared browser, account B sees account A's address and phone on `/checkout` (and the header/cart keep A's items until then), contradicting the ownership requirement.
- Fix: resolve the cart owner before rendering/initialising the form (gate on an owner-resolved flag and `form.reset()` on owner change) and stop persisting the shipping address, or clear it on sign-out.

### P3 - Low / hygiene

75. The idempotency fingerprint omits the chosen shipping option - [code]
- `lib/actions/order.actions.ts:493-518` hashes items, address, payment method, shipping price and total, but not `shippingRateId`, `isPickup` or the ETA. When a delivery and a pickup quote both cost 0 (e.g. free-shipping threshold plus store pickup), a re-submit returns the first order with the wrong fulfillment method.
- Fix: include the selected rate/pickup/ETA identity in the fingerprint and compare the existing order's shipping snapshot before returning it.

76. Some email templates concatenate an unstripped `siteUrl`, producing `//` paths - [code]
- `emails/index.tsx:24` passes `site.url` with its trailing slash; `order-update-email.tsx:59` and the verification/review templates build `${siteUrl}/...`. `purchase-receipt.tsx:75` strips the slash, so the fix is inconsistent.
- Fix: normalize once in `getSender()` (`site.url.replace(/\/+$/, '')`) or pass `getSiteUrl()`.

77. Currency flash is still present for non-SAR visitors - [code] (known residual)
- `hooks/use-setting-store.ts:14-17` initialises with the seed SAR defaults and `components/shared/settings-initializer.tsx` applies the cookie currency in a `useEffect`, so server-rendered prices paint the seed currency and flip after hydration.
- Fix: pass the server-selected currency through a provider/context (or a server-rendered data attribute) instead of mutating a module store after mount.

### Live smoke test (2026-10-31)

- `npm run i18n:check`: OK, 805 identical keys in en-US/ar/fr.
- Public routes return 200 (`/`, `/ar`, `/fr`, `/search`, `/cart`, `/sign-in`, `/sign-up`, `/forgot-password`, `/verify-email`, sitemap, robots).
- `/en-US` returns 307 (expected locale redirect); `/checkout`, `/account`, `/admin`, `/invoice/:id` return 302 to sign-in when unauthenticated.
- `/api/debug-ip` returns 404 in production; `/api/cron/payment-recovery` and `/api/cron/stock-reservations` return 401 without the Bearer token.
- Anomalies: absent product/page slugs return 200 (item 59), `/fr/fr/search?page=2` returns 404 (item 58), and `/search?category=T-Shirts&page=2` shows "10 - 9 of 6" with no products (item 60).
- The production build itself succeeded on Vercel (`ecommerce-template-4kyt1kgom`, 1m 42s).

### Verified clean (negative results)

- No IDOR found in order/payment/invoice paths reviewed: owner/admin checks are applied, admin actions use `requireAdmin`, and `dbOrderWith3UserKeys` stays private.
- Stripe signature verification, Moyasar constant-time token + gateway re-fetch + amount/currency checks, and `PaymentEvent` uniqueness are intact.
- Review moderation is server-enforced: non-buyers are rejected and `isVerifiedPurchase`/`isApproved` cannot be set by the client. Review aggregates match the approved reviews (315 reviews, 0 rating/count mismatches).
- `safeCallbackUrl` is used at every callback site; Google account linking is disabled; OTPs use `crypto.randomInt` with per-account lockout; reset tokens are hashed, single-use and expiring.
- Markdown/admin content is sanitized; no XSS path found.
- i18n key sets are identical across the three locales.

### Suggested fix order

1. Item 49 immediately (remove the seed bundle, rotate any seeded passwords), then 50 (email origin) and 56 (missing OG image).
2. Payment integrity: 51, 52, 53, 64, 65, 63.
3. SEO and navigation: 55, 57, 58, 59, 60; then 61, 62, 66-74.
4. ZATCA (54) before production onboarding; hygiene items 75-77 in one pass.

