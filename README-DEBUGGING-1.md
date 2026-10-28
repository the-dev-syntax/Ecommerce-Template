GLM-1-DEBUGGING:
All four audits are done and I've personally re-verified the headline findings in the code (open redirect, Math.random OTP, plaintext seed password, COD expiresAt: undefined, raw updateSetting write, missing model indexes, dead /account/addresses link, plain next/link vs next-intl, formatError leak, unvalidated browsing-history API, client-controlled isVerifiedPurchase). Two items the agents cited slightly differently resolved the same way (the isVerifiedPurchase leak flows through ReviewInputSchema.parse({...data}), not a named field in the action).

P0 — Critical (security / account takeover / data-loss)
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
- lib/data.ts:58 (password: 'totalena#1And4' for a real seed account — can never log in since bcrypt.compare(plain, plain) fails), and user.model.ts has no pre('save') hash, so any future direct .save() path stores plaintext. Seed credentials also sit in comments (data.ts:9-11).
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
P1 — High (money, stock, order integrity)
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
P2 — Medium (public 500s, i18n, checkout UX)
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
P3 — Low / hygiene / suspected (needs runtime confirmation)
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

