# Essential Vital — Production Readiness Log

Changes are recorded here in the order they are implemented. Each point lists what changed and why.

## P3-B — MC1-bugs: checkout state, cart races, variant matching, Stripe webhook, Suspense (2026-10-30)

- **Checkout state edges (40):** changing the address or payment method now collapses the later steps instead of force-opening them, so the summary cannot show a payment/shipping choice priced for an old address. A persisted payment method that is no longer enabled (COD disabled, provider unconfigured) is resolved to the first enabled method and written back to the cart, so the displayed COD fee and the submitted method match. Place-order sends the index the UI actually shows (`selectedDeliveryIndex`) rather than the raw store value, rejects a missing delivery option, and the cart store already persists the index resolved by `calcDeliveryDateAndPrice`, so a changed rate list cannot silently map the stored index to a different quote. Why: each edge could submit an option that was never priced, including a COD order without its fee.
- **Cart write races (41):** all repricing mutators (`addItem`, `updateItem`, `removeItem`, `refreshCart`, `setShippingAddress`, `setPaymentMethod`, `setDeliveryDateIndex`) run through one promise queue and read `get()` when their turn starts. Why: two rapid changes (quantity + shipping speed) used to race, and the slower server response overwrote the newer cart with stale prices.
- **Variant substitution (42):** legacy cart lines with size/color but no `variantId` must match an existing variant; if no variant has those options, order creation throws instead of silently falling back to the default/first variant (which could be a different size, colour and price). The default variant is only used when the line has no options at all. Why: payment could show one variant while the order was created for another.
- **Shared-device cart leakage (43):** the persisted cart now records the signed-in `ownerId`. Checkout claims the cart for the current session user, and when a different signed-in account takes over the browser, the items, address and phone are cleared before repricing. Guest → signed-in keeps the cart (the cart intentionally survives the sign-in round-trip). Why: a single `EV-cart` key used to hand the previous customer's items and delivery details to the next account.
- **Stripe webhook (44):** removed the legacy `charge.succeeded` fulfillment path; only `payment_intent.succeeded` fulfils an order. Dispute events and failure logging are unchanged. Why: the charge path compared `charge.amount` (which differs for partial/odd capture flows) and duplicated the intent path; Stripe sends the intent event for successful payments.
- **Suspense boundaries (45):** both `stripe-payment-success` and `moyasar-payment-success` use `useSearchParams()` inside a local `<Suspense>` boundary with a shared loading fallback. Why: without the boundary the whole route opted out of static rendering (build warning/error) instead of only the query-dependent part.
- Verified with `npx tsc --noEmit`, `npm run lint` and `npm test`. These are UI/store race fixes; the existing validator/order/server-action tests were rerun rather than adding a browser-only test for the checkout state machine.

## Phone verification — MC1-bugs (2026-10-30)

- **Locked Saudi number:** checkout and the address book now use a shared `PhoneVerification` field with a fixed `+966` prefix and exactly 9 national digits (`5XXXXXXXX`). `normalizeSaudiPhone()` accepts the formats Tawked accepts (`055…`, `551…`, `966…`, `00966…`, `+966…`) and returns E.164; `ShippingAddressSchema` rejects anything that is not a Saudi mobile. The development checkout default was changed from an invalid landline-style number to `512345678`.
- **Tawked Verify integration:** `lib/tawked.ts` calls `POST /v1/verify/start` (Bearer `TAWKED_SMS_API_KEY`, `Idempotency-Key`, `reference`, `client_ip`, language) and `POST /v1/verify/check`. One retry reuses the idempotency key for network/5xx failures, so a retry cannot send or charge a second SMS. The verification `id` is stored server-side only (`phoneOtpId`, `phoneOtpPhone`, `phoneOtpExpires`, all `select: false`); the browser only receives "code sent".
- **Persistence:** a successful check sets `phone` (E.164), `phoneVerified: true`, `phoneVerifiedAt`, and appends the number to `verifiedPhones`. `phoneVerified` is never accepted from the client; only Tawked's `check` answer sets it.
- **Requirement enforced server-side:** `createOrderFromCart` rejects an order unless the shipping phone is in the user's verified numbers, and `saveUserAddress` rejects saving an unverified phone. The checkout and address-book forms also check before submitting and show a toast.
- **Rate limits:** 5 starts / 10 min and 20 checks / 10 min per account, in addition to Tawked's per-number/per-IP guard. The limiter fails open (verification itself still always runs).
- **Errors:** Tawked's stable `error` strings are mapped to actionable messages (`invalid_destination`, `rate_limited`, `ip_rate_limited`, sandbox-only number, missing configuration); every other failure shows a generic message and logs `X-Request-Id` context.
- **Config:** `TAWKED_SMS_API_KEY` (required for the layer) and optional `TAWKED_API_BASE` documented in `.env.example`.
- Added `tests/phone.test.ts` for normalization/formatting. The 9-digit rule is intentional: Saudi mobile numbers have 9 national digits after `+966`; Tawked rejects longer ones.

## P3-A — MC1-bugs: shipping weight, validation, UTC dates, order keys (2026-10-29)

- **Shipping weight (35):** products now have a product-level `weight` (model, `ProductInputSchema`/form schema, admin form field, create/edit defaults). Order lines use `variant.weight ?? product.weight ?? 0`. Why: non-variant products were always priced at 0 kg, so `extraPerKg` surcharges never applied.
- **Address/rate validation (36):** `ShippingAddressSchema` now requires a plausible phone (digits plus space/`+`/`-`/parentheses, at least 7 digits), an alphanumeric postal code and an alphanumeric national address. `ShippingRateSchema` caps monetary fields and validates `etaMinDays <= etaMaxDays` (also on update). Why: `"x"` passed as a phone number, and inverted ETAs or absurd amounts could be saved and then distort checkout quotes.
- **UTC date handling (37):** `parseDateParam` parses day boundaries as UTC, the six-month sales window starts at a UTC month boundary, and `$dateToString` groups explicitly with `timezone: 'UTC'`. Why: server-local midnight boundaries were being bucketed by UTC in Mongo, shifting a few hours of orders into the wrong day/month and diverging from the VAT report (which already used UTC).
- **Verification email (38):** already resolved by the P0-6 work — `checkAndSetEmailRateLimit` runs before account creation and before `sendVerificationEmail`. No further change.
- **Order item keys (39):** the order details table keys rows by `clientId` (falling back to `slug` + index) instead of `slug`, so two variants of the same product no longer share a React key.
- Added `tests/p3-validation.test.ts` (address/rate/product validation and UTC date parsing).

## P2-D — MC1-bugs: single site-URL source (2026-10-28)

- Added `getSiteUrl()` in `lib/env.ts` and used it in `app/sitemap.ts`, `app/robots.ts` and the locale layout's `metadataBase`. It accepts `NEXT_PUBLIC_SITE_URL`, the legacy `NEXT_PUBLIC_SERVER_URL`/`SITE_URL` names, Vercel's production URL, then the store setting, and strips trailing slashes. `.env.example` documents the precedence. Why: the sitemap read `NEXT_PUBLIC_SITE_URL` while robots read `NEXT_PUBLIC_SERVER_URL`, so a deployment could advertise the real domain in one file and `localhost` in the other; the layout had a third, slightly different fallback chain. Added `tests/site-url.test.ts`.

## P2-C — MC1-bugs: address book, public API hardening, currency and public limits (2026-10-28)

- **Saved address book (29):** `User.addresses[]` stores entries with opaque server-generated ids, validated by `UserAddressSchema`. `lib/actions/address.actions.ts` lists/saves/deletes/sets-default (max 10, exactly one default, deleting the default promotes another), and `/account/addresses` provides the editor. Checkout pre-fills the default address and offers a saved-address selector. Why: the account hub linked to a page that did not exist, and every checkout re-typed the address.

- **Browsing-history API (30):** ids are validated as 24-hex and capped at 50, categories at 20 entries / 100 chars; the endpoint honours `features.browsingHistory`, and returns only card fields (no SKUs or tax metadata). The client builds its query with `URLSearchParams` and renders only after mount. Why: raw comma splitting produced CastError 500s, an unbounded `$in`, full product documents on a public endpoint, and broken queries for values containing `,`, `&`, `%` or spaces; the persisted-store render also caused hydration mismatches.

- **Currency (31):** footer currency changes now persist through `setCurrencyOnServer`, like the header. The store still hydrates from the SSR setting in a regular effect (after hydration): a layout effect avoided the price flash but updated the shared store while sibling components were still hydrating, producing a mismatch on `ProductPrice` (server default currency vs cookie currency). A true no-flash fix needs the currency passed through React context/props instead of a module-level store — documented residual.

- **Home banners (32):** Best Sellers and Featured links now use their real tags (`best-seller`, `featured`), and category links are `encodeURIComponent`-encoded on the home page and in the header sidebar. Why: both banners opened New Arrivals, and `&`/spaces in category names corrupted the query.

- **Public limits and caches (33):** per-IP buckets for `calcDeliveryDateAndPrice` (60/min) and `setCurrencyOnServer` (10/min); 60-second in-process caches for active shipping rates (cleared on admin create/update/delete) and for product categories/tags (cleared on product writes). 

- `getAllProducts` caps text to 100 chars, validates rating to 0–5 and price to `min-max` pairs. Why: every cart mutation re-queried products and shipping rates, popular public actions had no limiter, and search accepted unbounded strings and NaN/negative values. Per the agreed scope, `getAllProducts` is capped/cached rather than IP-limited so crawlers are not throttled.

## P2-B — MC1-bugs: middleware, checkout reliability and gallery fallback (2026-10-28)

- Middleware now parses the locale as an exact first segment (`splitLocaleFromPathname` in `lib/locale-path.ts`) instead of `pathname.startsWith('/fr')`, which also matched `/friends-page` and `/archives`. Protected routes are an explicit list (`/account`, `/admin`, `/checkout`, `/invoice`); any other non-public path is passed to the intl middleware so unknown URLs render a 404 instead of redirecting guests to sign-in. Added locale-parsing tests to `tests/routing-sort.test.ts`.

- Redirects built by middleware now omit the prefix for the default locale (`/sign-in` instead of `/en-US/sign-in`, `/verify-email` instead of `/en-US/verify-email`), removing the extra 308 hop under `localePrefix: 'as-needed'`.

- The email-verification gate compares the locale-less pathname with exact prefixes instead of `pathname.includes('/account')`, and `/invoice` was added to the gated routes so unverified users cannot open tax invoices while being blocked from orders.

- Cart writes are awaited: the checkout address step waits for `setShippingAddress` (showing a destructive toast and staying on the step on failure), payment-method/delivery-date changes and the cart/cart-sidebar quantity and remove handlers catch errors, and the checkout page refreshes the persisted cart on mount. `refreshCart` prunes lines whose product or variant no longer exists via the new `getAvailableCartItemIds` action before repricing, so a stale localStorage cart no longer fails later with "Product is no longer available". Placing an order also guards empty carts and a missing address.

- `ProductGallery` renders an image-off placeholder when a product has no images and keeps the selected index in range. Why: `images[0]` on an empty array crashed the product page with `Invalid src`, and the schema only guarantees images for newly created products.

## P2-A — MC1-bugs: 500s and locale-preserving navigation (2026-10-28)

- Sort options are whitelisted. `getAllProducts` maps `sort` through `PRODUCT_SORT_QUERY` and falls back to `DEFAULT_PRODUCT_SORT`, and the search page normalizes `?sort=` before passing it to the selector, which no longer uses a non-null assertion (`?.name ?? t('Best selling')`). Why: any unknown `?sort=` value crashed the selector during render (500), while the database query silently fell back to an unrelated order.
- `getProductBySlug` and `getWebPageBySlug` now return `null` instead of throwing, and the product page calls `notFound()` (metadata returns a safe title). Why: stale or unpublished product/page URLs returned 500 to visitors and crawlers, and the existing `if (!webPage) notFound()` branch was unreachable.
- Storefront, auth and checkout navigation now uses the locale-aware `Link`/`useRouter` from `@/i18n/routing` instead of `next/link` and `next/navigation`. The header search form builds its action from the active locale, and server redirects use `localizedPath()`. Why: with `localePrefix: 'as-needed'`, plain links dropped `/ar` and `/fr` users back into the default English locale mid-journey.
- Language and currency switchers keep the query string (`useSearchParams`) when changing locale. Why: switching language discarded search terms, filters and the selected variant.
- Removed the empty `pathnames` map from `i18n/routing.ts` so `Link` accepts plain string hrefs again; no localized path segments exist in this app. Added `tests/routing-sort.test.ts`.

## P1-1 — MC1-bugs: stock, shipping and data-integrity fixes (2026-10-28)

- COD stock reservations now expire after 72 hours instead of never (`COD_RESERVATION_TTL_MS`), and the online-payment hold is 60 minutes instead of 30. `createStripePaymentIntent` and `createPayPalOrder` refresh the hold with `extendStockReservation` while the customer completes 3-D Secure/redirect, so a payment started in time is not released mid-checkout. Why: an abandoned COD order used to lock inventory forever, and a slow payment could lose its reservation before the webhook arrived.
- `releaseExpiredReservations` now re-reads the order inside its transaction and, if it is already paid, marks the reservation `committed` instead of restocking. Why: the sweep could race a concurrent payment and restore stock that fulfillment had already decremented, producing phantom inventory and oversell.
- Order creation is idempotent per cart: `createOrderFromCart` computes a server-side `cartFingerprint` (user + rebuilt lines + address + payment method + prices) and returns an existing `pending_payment` order created from the same cart within 30 minutes. The fingerprint is stored on the order (indexed). Why: the previous guard was client-only, so Back → "Place your order" (or a double submit) created a second order and a second stock reservation.
- Shipping coverage is enforced: when the store has active shipping rates and an address matches none, `createOrderFromCart` now throws `Shipping is not available for this address` instead of silently quoting the legacy global delivery dates and dropping the COD fee. `ShippingQuote` now exposes `codAvailable`, and COD is rejected when the selected service disables it. Why: unserved addresses could place under-priced orders that the admin never intended to accept.
- `updateSetting` validates the payload with `SettingInputSchema` before writing, and `getSetting`'s process cache now has a 30-second TTL (still refreshed immediately by `updateSetting`). Why: a malformed admin payload could corrupt the tax/free-shipping settings, and other serverless instances served stale settings until a cold start.
- Moyasar dashboard refunds now restock inventory. `restockFullyRefundedOrder` restocks the un-restocked units of a full refund inside a transaction, is idempotent per line via `items[].restockedQuantity`, and is also called on webhook retries. `cancelOrderById` now records `restockedQuantity` as well. Why: refunds issued in the Moyasar dashboard previously left stock decremented forever, unlike admin cancellations and returns.
- `formatError` no longer returns raw driver/vendor/stack text. Zod, validation and duplicate-key messages are preserved; short domain messages (for example "Not enough stock…") stay actionable; CastError/Mongo/connection/stack-shaped messages are logged and replaced with a generic message. Added `tests/error-format.test.ts`.
- "Verified Purchase" is now derived on the server from a paid order containing the product (`Order.exists(...)`); the client-supplied flag is overwritten on create and update. Why: any signed-in user could claim the badge by calling the action directly.
- Added hot-path indexes: `orders` `(user, createdAt)`, `(createdAt)` and `(user, cartFingerprint, status, createdAt)`; `reviews` `(product, createdAt)` and `(product, user)`; `shipping-rates` `(country, region, city, carrier, serviceName)`. `upsertShippingRate` rejects a duplicate carrier/service/area pair before insert/update. Why: order/review lists were collection scans, and duplicate rate rows produced ambiguous checkout options and delivery indexes.
- Residual (documented, not automated): if a gateway captures a payment after the reservation has already expired *and* the stock was sold meanwhile, fulfillment still needs a provider-specific auto-refund/manual review. The longer TTL and intent-time refresh make this window much smaller, but a complete auto-refund loop is a separate provider-by-provider change.

## P0-34 — MC1-bugs: account and auth security hardening (2026-10-28)

- Added `safeCallbackUrl()` in `lib/utils.ts` and used it in `app/[locale]/(auth)/sign-in/page.tsx`, `sign-in/credentials-signin-form.tsx` and `sign-up/page.tsx`. It only accepts same-origin relative paths, rejecting absolute URLs, protocol-relative `//host` values and backslash tricks. The sign-up → sign-in link now also `encodeURIComponent`s the callback. Why: `redirect(callbackUrl)` followed attacker-supplied absolute URLs (open redirect after sign-in).
- Set `allowDangerousEmailAccountLinking: false` on the Google provider in `auth.ts`. Why: it auto-linked a Google identity to any existing same-email credentials account, letting an attacker who registered a victim's email first take over the account when the victim used "Continue with Google".
- Hardened the `jwt` callback in `auth.ts`: it now only calls `findById` for valid ObjectIds, falls back to the token email for legacy/OAuth ids, and pins `token.sub` to the Mongoose `_id` so account-scoped actions always receive a usable id. Why: a failed id lookup used to be swallowed into a session whose id could not be used by any user/order action.
- Email changes are now pending until verified. `lib/db/models/user.model.ts` gains `pendingEmail`, `pendingEmailToken` and `pendingEmailExpires`; `updateUserEmail` requires the current password, stores the new address as pending, and leaves the current email active. `verifyEmailOtp` swaps the address atomically only when the OTP matches the pending token. `sendVerifyEmailAgain` resends to the pending address. The email form collects the current password and routes to `/verify-email`. Why: a stolen session could previously move the account to an attacker-controlled mailbox before the new address was verified, and the shared `verificationToken` let signup/resend/email-change flows clobber each other.
- Replaced `Math.random()` in `generateOtp()` with `crypto.randomInt()`, and added per-account OTP throttling (`failedOtpAttempts`, `otpLockedUntil`, five failures → 15-minute lockout) in `verifyEmailOtp`. Why: the OTP is a credential that unlocks checkout/account access, and IP-only limits are bypassable.
- Hashed the plaintext seed password for `jack@example.com` in `lib/data.ts` and added a `pre('save')` hook in `user.model.ts` that hashes any non-bcrypt password. The hook skips values that already carry a bcrypt prefix, so existing hash-then-create flows are unchanged. Why: the seeded account could never sign in (`bcrypt.compare` against plaintext) and any future `.save()` path would persist a plaintext password.
- Made email flows enumeration-safe: registration, email change and resend return the same success-shaped message whether or not the address exists; unverified existing accounts still receive a code, verified ones do not. The per-email limiter now runs before the account is created and before any email is sent. Why: distinct error messages revealed which addresses had accounts, and the limiter previously ran after the email had already gone out.
- `getIP()` in `lib/rate-limit.ts` now prefers trusted edge/proxy headers (`TRUSTED_IP_HEADER`, `x-vercel-forwarded-for`, `x-real-ip`, `cf-connecting-ip`) and falls back to the right-most `X-Forwarded-For` value. The left-most entry was client-controlled and could be rotated to defeat sign-in, reset and OTP limits.
- `lib/db/seed.ts` refuses to run on production/Vercel unless `--force` (or `SEED_ALLOW_DESTRUCTIVE=true`) is passed. Why: `npm run seed` deletes settings, users, products, reviews and orders.
- Added `tests/callback-url.test.ts` covering accepted and rejected callback targets.

## P0-1 — Security hardening (2026-10-18)

- Removed `app/api/stripe-worker/route.ts`. It was publicly reachable and accepted an unsigned JSON payload that could mark any order as paid. Payment fulfillment must only run through the signature-verified Stripe webhook (or another explicitly verified worker).
- Added admin-role enforcement in `middleware.ts`: every `/admin/*` route now requires `session.user.role === 'admin'`, not just any logged-in session.
- Added a second admin-role check in `app/[locale]/admin/layout.tsx` as defense in depth; non-admins are redirected to the storefront.
- Changed `updateOrderToPaid` in `lib/actions/order.actions.ts` to use `requireAdmin(...)`. Previously an order owner could invoke the action and mark their own order as paid.
- Restricted UploadThing uploads in `app/api/uploadthing/core.ts` to admins. Previously any logged-in customer could upload files to the store's storage quota.
- Why: these were direct paths to fake paid orders, unauthorized admin access, and storage abuse. They must be closed before any real order can be accepted.

## P0-2 — Server-side order re-pricing and validation (2026-10-18)

- Added `buildOrderItems` in `lib/actions/order.actions.ts`. Every cart line is re-fetched from MongoDB; names, slugs, images, categories, prices, stock, sizes and colors come from the database, never from the browser.
- `createOrderFromCart` now ignores client-supplied `itemsPrice`, `shippingPrice`, `taxPrice`, `totalPrice` and `expectedDeliveryDate`. It recalculates the items price from DB prices, shipping/tax from settings, and the delivery date from the selected delivery option.
- Added validation: the product must exist and be published, quantity must be an integer >= 1 and <= stock, size/color must be valid for the product, the delivery index must be valid, the payment method must be enabled in settings, and the session user must match the order owner.
- `calcDeliveryDateAndPrice` now also re-prices the cart from the DB, so cart and checkout totals cannot be tampered with. An empty cart is still allowed while the customer removes items.
- Tightened `OrderItemSchema.quantity` to a positive integer in `lib/validator.ts`.
- Added a duplicate-submit guard (`isPlacingOrder`) to the checkout buttons so double-clicks cannot create two orders.
- Why: previously a customer could edit the persisted cart and submit any price, stock value or payment method, and the server stored it as-is.

## P0-3 — Single idempotent fulfillment path for every payment provider (2026-10-18)
> idempotent means that making the same API request multiple times will yield the exact same server state and result as executing it a single time

- Added `lib/orders/fulfill-order.ts`. It is now the only code that marks an order paid, decrements stock and increments `numSales`. It runs inside a MongoDB transaction and re-checks the order, payment method, currency and paid amount before writing.
- Fulfillment is idempotent. A duplicate webhook or double approval sees `isPaid` and returns without decrementing stock again. Concurrent calls conflict on the order document, so the transaction retries and then observes the paid order.
- Stock is decremented with an atomic `countInStock >= quantity` filter, so an oversold line aborts the whole transaction instead of producing negative stock.
- Purchase receipts are sent at most once via `receiptSentAt`, claimed atomically before sending. A failed email clears the claim so a later retry can send it, and an email failure never un-pays an order.
- `app/api/webhooks/stripe/route.ts` now fulfills from `payment_intent.succeeded` (signature-verified), with a `charge.succeeded` fallback, and returns HTTP 500 on fulfillment failure so Stripe retries. It verifies the paid amount and currency against the stored order.
- `approvePayPalOrder` checks that the PayPal order ID matches the one stored on the order, captures the payment, and passes the captured amount/currency to `fulfillOrder` instead of trusting client input.
- `updateOrderToPaidByStripe` (success-page fallback) retrieves the PaymentIntent from Stripe, verifies its status, `orderId` metadata, amount and currency, then calls `fulfillOrder`.
- `updateOrderToPaid` (admin/manual) also goes through `fulfillOrder`, so manual payments get the same stock and receipt handling.
- Added `currency`, `receiptSentAt` and `paymentResult.pricePaid` to `lib/db/models/order.model.ts`. `currency` is set from `getSetting().defaultCurrency` when the order is created and is required by `OrderInputSchema`.
- `createStripePaymentIntent` reuses an existing reusable PaymentIntent, returns an error for already-paid/processing intents, and stores the intent ID on the order. `paypal.createOrder` now sends the order currency and a two-decimal amount.
- Why: payment completion could previously be triggered by an unsigned worker, a success-page call, a webhook or a manual admin action, each with its own stock and email logic. That allowed double stock decrements, races between providers, and orders marked paid without matching the captured amount.

## P0-4 — Remove credential, OTP and PII logging (2026-10-18)

- Removed `console.log('signInWithCredentials', user)` from `lib/actions/user.actions.ts`. It wrote the plaintext password to server logs on every sign-in.
- Removed the sign-up and user-update `console.log` calls that serialized full user objects, including the password, password hash, email address and role.
- Removed the verification-email logs in `emails/verification-email.tsx` and `emails/index.tsx` that printed the recipient address and the OTP.
- Removed client-side debug logs in `app/[locale]/(auth)/sign-up/signup-form.tsx` (form values contain the password), `app/[locale]/verify-email/VerifyClientToken.tsx`, the account manage page (full session) and the admin user edit form (user object and submitted values).
- Sanitized the remaining error logs in `updateUserEmail` and `sendReceiptOnce` so they no longer serialize user or order data.
- Why: application logs are retained and forwarded by hosting providers. Logging passwords, OTPs or full user/session objects turns routine debugging output into a credential and PII disclosure.

## P0-5 — Revalidate session role from the database (2026-10-18)

- The `session` callback in `auth.ts` now re-reads `name`, `email`, `role` and `emailVerified` from the `users` collection on every session build instead of copying them from the JWT.
- If the account no longer exists, the session is reduced to a non-privileged guest (`role: 'user'`, `emailVerified: null`).
- If the database lookup fails, the callback fails closed the same way, so a transient error can never leave a stale `admin` role in place.
- The JWT still stores identity for edge middleware, but every Node-side `auth()` call (admin layout, admin pages, every server action, UploadThing) now sees the current database role.
- Why: with JWT sessions, demoting or deleting an admin did not revoke their privileges until the token expired. A removed admin could keep using `/admin` and admin server actions for the remaining token lifetime.

## P0-6 — Rate-limit credential sign-in (2026-10-18)

- Added `limitSignInAttempts` in `lib/rate-limit.ts` with two Upstash sliding windows: 30 attempts per 10 minutes per IP and 10 attempts per 10 minutes per normalized email.
- Wired it into the Credentials `authorize` callback in `auth.ts` before `User.authenticate`, so the limit applies even when an attacker calls the NextAuth callback directly instead of using the sign-in form.
- Over-limit attempts return the same generic failure as bad credentials, so the response does not reveal whether the email exists or that a limiter fired.
- The limiter fails closed if Redis is unavailable, matching the existing auth-action limiters.
- Why: the credentials endpoint had no lockout or throttling, so an attacker could guess passwords indefinitely. Per-IP limits blunt one-source attacks; per-email limits blunt distributed attacks against a single account.

## P0-7 — Password change for signed-in users (2026-10-18)

- Added `ChangePasswordSchema` in `lib/validator.ts`: current password required, new password must satisfy the existing password policy, confirmation must match, and the new password must differ from the current one.
- Added `updateUserPassword` in `lib/actions/user.actions.ts`. It requires a session, rate-limits attempts, verifies the current password with bcrypt, and stores the new hash with bcrypt cost 12. Google-only accounts without a password get an explicit error instead of a misleading one.
- Added `app/[locale]/(root)/account/manage/password/page.tsx` and `password-form.tsx`. This fixes the existing `/account/manage/password` link, which previously pointed to a missing route.
- Added the new UI strings to `en-US`, `ar` and `fr`.
- Why: users had no way to rotate a compromised password while signed in, and the account UI exposed a dead "Edit password" link.

## P0-8 — Account recovery and password-change session invalidation (2026-10-18)

- Added `passwordResetToken` (hashed), `passwordResetExpires` and `passwordChangedAt` to `lib/db/models/user.model.ts`. Reset tokens are SHA-256 hashes; the raw token is only sent by email.
- Added `requestPasswordReset` and `resetPassword` in `lib/actions/user.actions.ts`. A request always returns the same generic message, so it cannot be used to discover registered emails. Tokens expire after 30 minutes and are single-use: the reset update filters on the hash and expiry and clears both fields atomically.
- Reset requests are rate-limited per IP (5 per 15 minutes) and per email (3 per 15 minutes); token submissions are rate-limited per IP (20 per 15 minutes).
- Added `emails/password-reset-email.tsx` and `sendPasswordResetEmail`. The email contains a link to `/reset-password` and states the expiry.
- Added public `/forgot-password` and `/reset-password` pages, added both to the middleware public list, and added a "Forgot Password" link to the sign-in form.
- Password change (`updateUserPassword`) now also clears outstanding reset tokens and sets `passwordChangedAt`.
- Session invalidation: the JWT callback stores the original sign-in time (`authTime`) and compares it with `passwordChangedAt` on every session read. Tokens issued before a password change/reset return `null`, which makes Auth.js clear the session cookie. Deleted accounts are treated the same way. Role/email/verification freshness from P0-5 now happens in the same JWT callback.
- Added an account-layout guard that redirects to `/sign-in` when the session is no longer valid.
- Why: there was no recovery path at all, and a password reset without invalidation would leave an attacker's existing JWT (up to 30 days) working after the victim recovered the account.

## P0-9 — Case-insensitive email handling (2026-10-18)

- `User.authenticate` in `lib/db/models/user.model.ts` now normalizes the email and looks it up with a case-insensitive collation (`locale: 'en', strength: 2`). Previously a user who registered `user@example.com` could not sign in as `User@Example.com`, and mixed-case accounts created by Google were unreachable by credentials login.
- `authorize` in `auth.ts` normalizes the email before the sign-in rate limiter and `User.authenticate`, so the limiter buckets all case variants of the same address together.
- Fixed `updateUserEmail`: it queried `{ normalizedEmail }` — a field that does not exist — so the duplicate check never ran. It now queries `{ email: normalizedEmail }` with the same collation.
- Registration and admin user updates now perform their duplicate-email checks with the same case-insensitive collation.
- Why: registration and email changes stored lowercased addresses, but lookups were exact-match. That caused failed logins for case variants and allowed case-variant duplicates to slip past the pre-checks (the database unique index is case-sensitive).
- Production note: the existing unique index on `email` is case-sensitive. A one-time audit should confirm there are no case-variant duplicates, and the index can be replaced with a case-insensitive unique index (`collation: { locale: 'en', strength: 2 }`) during deployment.

## P0-10 — Prevent deleting the last admin (2026-10-18)

- `deleteUser` in `lib/actions/user.actions.ts` now loads the target user first and, when the target is an admin, counts the remaining admins. If only one admin exists, deletion is refused.
- This mirrors the existing last-admin guard in `updateUser`, which prevents demoting the last admin.
- Why: an admin could delete the only admin account (including themselves) and permanently lock everyone out of `/admin`, products, orders and settings. The only recovery would be a manual database edit.

## P0-11 — Bound user-controlled payloads (2026-10-18)

- `OrderInputSchema` and `CartSchema` now cap `items` at 50. `buildOrderItems` enforces the same cap before querying products, so an oversized array is rejected before any database work.
- `OrderItemSchema` now requires a real MongoDB ObjectId for `product` and caps `clientId`, `name`, `slug`, `category`, `image`, `size` and `color`.
- `ShippingAddressSchema` caps every field (`fullName` 100, `street` 200, `city` 100, `postalCode` 20, `province` 100, `phone` 30, `country` 100).
- `ReviewInputSchema` caps title at 120 and comment at 3000 characters.
- `Email` is capped at 254 characters and `Password` at 72 characters (bcrypt's effective input limit).
- Browsing-history sync slices incoming items to `MAX_BROWSING_HISTORY`, accepts only valid ObjectId product ids and string categories, and caps category length before writing.
- Why: server actions and the browsing-history beacon accepted unbounded arrays and strings. A logged-in user could store huge order/review/address values or make the server iterate and query over oversized arrays, bloating the database and wasting CPU.

## P0-12 — Only published content is public, search input is escaped (2026-10-18)

- `getAllProductSlugs` and `getAllWebPageSlugs` now filter `isPublished: true`, so the sitemap no longer advertises draft products or pages.
- The browsing-history recommendation API (`/api/products/browsing-history`) now filters `isPublished: true` for both history and category results.
- `getAllProducts` now applies `isPublished` to the count query as well as the results query, so pagination matches the visible products.
- Product search now escapes user input before building the `$regex` filter in both the storefront and admin product lists. Previously a crafted query could act as an arbitrary regular expression and consume excessive database CPU.
- Why: unpublished products/pages were reachable through bulk public endpoints and the sitemap, and raw regex input was a denial-of-service vector.

## P0-13 — Paid orders cannot be hard-deleted (2026-10-18)

- `deleteOrder` in `lib/actions/order.actions.ts` now loads the order and refuses deletion when `isPaid` is true.
- The admin order list only renders the delete dialog for unpaid orders.
- Why: deleting a paid order removed the payment record and order history while leaving stock and `numSales` already decremented, breaking accounting and sales reports. Paid orders must be retained; cancellation/refunds should be handled as new records instead.

## P0-14 — Baseline security headers (2026-10-18)

- `next.config.ts` now sends `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Content-Security-Policy: frame-ancestors 'self'`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera/microphone/geolocation disabled) and `X-Permitted-Cross-Domain-Policies: none` on every response.
- `Strict-Transport-Security` (`max-age=31536000; includeSubDomains`) is added in production only.
- `poweredByHeader: false` removes the `X-Powered-By: Next.js` version hint.
- Why: these are the baseline browser protections against MIME sniffing, clickjacking, referrer leakage, unnecessary device permissions and protocol downgrade. A full resource CSP is left as a follow-up because Stripe, PayPal and UploadThing require a carefully tested allow-list.

## P0-15 — Lock down read helpers and bound pagination (2026-10-18)

- `dbOrderWith3UserKeys` in `lib/actions/order.actions.ts` is no longer exported. It lives in a `'use server'` module, so every exported function was a client-callable server action; an unauthenticated caller could read any order (items, shipping address, and the owner's name/email) by id. It is now a module-private helper used only after the calling action has authorized the session.
- `getProductById` and `getWebPageById` now require an admin session. They are only used by the admin edit pages and previously returned unpublished/draft records to anyone who called the action with an id.
- `getNoCachedSetting` now requires an admin session as well; it returns the uncached full settings document and is only used by the admin settings page.
- Added `clampPage` and `clampLimit` (`MAX_PAGE_SIZE = 100`) in `lib/utils.ts`. Pagination and `limit` values come from the client, so a caller could previously request an arbitrarily large page/limit and force MongoDB to scan and serialize huge result sets.
- Applied the clamps to `getAllProducts`, `getAllProductsForAdmin`, `getRelatedProductsByCategory`, `getProductsForCard`, `getProductsByTag`, `getReviews`, `getMyOrders`, `getAllOrders` and `getAllUsers`.
- Why: server actions exported from `'use server'` files are reachable by any client, even when the UI only calls them from an authenticated page. Read helpers therefore need their own authorization, and every client-supplied pagination value needs a hard upper bound.

## Fix — Regression audit of P0-1..P0-15 (2026-10-18)

Audited every P0 change against the current code. Regressions found and fixed:

- **P0-11 sign-in lockout.** `UserSignInSchema` reused the registration `Password` policy, so the new 72-character cap (and the older complexity rules) were applied when signing in. Accounts with legacy passwords that do not satisfy today's policy could no longer log in. Added a separate `SignInPassword` (`min 1`, `max 256`) in `lib/validator.ts:232`; registration keeps the full `Password` policy via `UserSignUpSchema` (`lib/validator.ts:270`).
- **P0-8 invalidation bypass for old tokens.** The JWT callback only rejected tokens when `token.authTime` existed. Tokens issued before that field was introduced therefore survived a password change/reset. `auth.ts:108` now also rejects tokens with no `authTime` once `passwordChangedAt` is set.
- **P0-15 fallback bypass.** `clampLimit` returned the fallback unchanged, so a `pageSize` setting above `MAX_PAGE_SIZE` bypassed the cap. `lib/utils.ts:69` now clamps the fallback too.
- **P0-2 size/color validation.** `buildOrderItems` accepted any size/color when the product had an empty `sizes`/`colors` array, contradicting the "must be valid for the product" rule. `lib/actions/order.actions.ts:85` now requires a match whenever a size/color is supplied.
- **P0-13 delete race.** `deleteOrder` read `isPaid` and then deleted in a second query, so a payment landing between the two could delete a paid order. `lib/actions/order.actions.ts:794` now deletes with `{ _id, isPaid: { $ne: true } }` atomically.
- **P0-3 intent reuse.** `createStripePaymentIntent` reused a stored PaymentIntent without re-checking its `orderId` metadata, amount or currency. `lib/actions/order.actions.ts:403` now verifies all three before returning its client secret.
- **P0-10 last-admin check.** The demotion guard queried MongoDB before `connectToDatabase()` and relied on mongoose buffering. `lib/actions/user.actions.ts:363` now connects first.

Known gaps (not regressions; left as follow-ups):

- Middleware runs `auth.config.ts`, whose JWT callback does not re-read the database. A demoted/deleted admin's role stays stale in middleware until the JWT expires, but every Node-side page/action re-checks the current role from the database.
- The unique index on `email` is still case-sensitive (see P0-9 production note).
- Invalidation only works where `passwordChangedAt` is set; accounts that never changed/reset a password keep their normal JWT lifetime.

### Verification
- `npx tsc --noEmit` — PASS
- `npm run lint` — PASS
- `npm run i18n:check` — PASS (479 keys in en-US, ar, fr)
- `npm run build` — PASS with `NODE_OPTIONS=--max-old-space-size=6144` after clearing `.next` (4096 hit the Windows heap limit during static generation)

## P0-16 — Per-user token version for session revocation (2026-10-18)

- Added `tokenVersion` (Number, default `0`) to `lib/db/models/user.model.ts` and to the JWT type in `types/next-auth.d.ts`.
- `auth.ts:120` uses `checkTokenVersion` (`lib/session-revocation.ts:27`) to compare the JWT value with the database. A mismatch returns `null`, which makes Auth.js clear the session cookie. Sessions issued before this field existed adopt the current value on first read; the `passwordChangedAt`/`authTime` check remains as a backstop.
- The version is incremented when a password is changed (`lib/actions/user.actions.ts:159`), when a password is reset (`lib/actions/user.actions.ts:283`), and when an admin changes a user's role (`lib/actions/user.actions.ts:429`). Account deletion is already covered because the JWT callback returns `null` when the user no longer exists.
- `updateUserPassword` now uses one guarded `findOneAndUpdate` that checks the old password hash and applies `$inc: { tokenVersion: 1 }` atomically, so concurrent password changes cannot lose a version bump.
- Added `revokeAllSessions` (`lib/actions/user.actions.ts:188`) and a “Sign out everywhere” control on `/account/manage` (`app/[locale]/(root)/account/manage/revoke-sessions-button.tsx`). It bumps `tokenVersion`, then signs the current device out.
- Why: an expiry blacklist is unbounded and unnecessary — expired tokens already fail `exp`. A monotonic per-user version invalidates every outstanding token with one small write and no new infrastructure, and is cleaner than comparing timestamps. Individual-device revocation is layered on top with a stable `sid` (P0-17).

### Verification
- `npx tsc --noEmit` — PASS
- `npm run lint` — PASS
- In-memory `checkTokenVersion` check (`adopt`/`valid`/`revoked`) — PASS
- `npm run i18n:check` — PASS (482 keys in en-US, ar, fr)
- `npm run build` — PASS

## P0-17 — Per-device revocation with a stable `sid` (2026-10-18)

- Added `lib/session-revocation.ts`. A stable `sid` is created once at sign-in (`auth.ts:94`) and preserved across the JWT re-encodes Auth.js performs on every session read. `jti` cannot be used here because Auth.js regenerates it on each encode (`@auth/core/jwt.js`).
- `revokeSession(sid, exp)` writes `v1:auth:revoked-session:<sid>` to Upstash Redis with a TTL equal to the token's remaining lifetime, capped at the 30-day session max age. Expired entries disappear automatically, so the denylist is bounded and needs no cleanup job.
- `isSessionRevoked(sid)` runs on every session build in `auth.ts` and in the Edge middleware (`auth.config.ts`), so a revoked device is stopped on the next request, not only when the token expires.
- The Auth.js `signOut` event now revokes the current `sid` (`auth.ts:168`). A copied cookie from a logged-out device therefore stops working immediately.
- Redis failures fail open (the `tokenVersion`/`passwordChangedAt` checks remain the hard boundary); the real Upstash host was unreachable during testing and the helper correctly swallowed the error instead of taking auth down.
- Why: `tokenVersion` revokes every session for a user, but it cannot revoke one device. A `sid` denylist adds per-device logout without a token table, unbounded storage, or DB lookups from the Edge.

Known limits:
- Sessions issued before this deploy have no `sid`; they are not denylisted (they still expire normally or are invalidated by `tokenVersion`).
- There is no "list my devices" UI. Revoking another device would need a session registry (`sessions:<userId>:<sid>` plus metadata); this change covers current-device revocation and the enforcement mechanism.

### Verification
- In-memory round-trip: revoked key found, unrelated key not found, TTL capped at 2,592,000s, past expiry clamped to 1s, Redis errors fail open — PASS
- `npx tsc --noEmit` — PASS
- `npm run lint` — PASS
- `npm run i18n:check` — PASS (482 keys in en-US, ar, fr)
- `npm run build` — PASS

## P0-18 — Moyasar provider, env validation, SAR base (2026-10-19)

- Added `.env.example` (names only) and `lib/env.ts` (lazy Zod validation, `getMoyasarConfig`, `isMoyasarConfigured`, `getMoyasarPublishableKey`). `.gitignore` now allows `.env.example`.
- Added `lib/payments/types.ts`, `lib/payments/index.ts` (provider registry: Moyasar/Stripe/PayPal/COD) and `lib/payments/moyasar.ts` (fetch payment, paid status, halalas conversion, constant-time webhook token check).
- Added `updateOrderToPaidByMoyasar` in `lib/actions/order.actions.ts`: verifies ownership, payment method, `orderId` metadata, amount and currency, then calls the idempotent `fulfillOrder`.
- Added `app/api/webhooks/moyasar/route.ts`: verifies `secret_token`, re-fetches the payment with the secret key, validates amount/currency/order, and fulfills idempotently. Requires `MOYASAR_WEBHOOK_SECRET`.
- Checkout: `moyasar-form.tsx` renders Moyasar's hosted form (Mada/Visa/Mastercard/Amex/UnionPay + STC Pay), `moyasar-payment-success` verifies the `?id=` callback, and `payment-form.tsx` renders it when the order payment method is `Moyasar`.
- Admin: payment method name inputs now suggest Moyasar/Stripe/PayPal/COD; Moyasar is in the seed defaults. Existing databases must add "Moyasar" in Admin → Settings → Payment Methods (or re-seed).
- Hardening: the callback page stops loading when `?id=` is missing, the webhook derives the order id from the fetched payment's metadata (and rejects invalid ObjectIds) instead of trusting the webhook body, secret/publishable/webhook config getters are decoupled so the webhook does not require a publishable key, the Moyasar script retries after a CDN failure, and the missing-config message is localized.
- Currency: SAR is now the base currency (`availableCurrencies` rates are relative to SAR), `defaultCurrency: 'SAR'`, the layout fallback uses the store default instead of hardcoded USD, `formatCurrency` accepts currency/locale, emails use the order currency, and `setCurrencyOnServer` validates the code and sets an HttpOnly/SameSite cookie.
- Apple Pay was enabled later in P0-19. The form then enabled card networks and STC Pay only.
- Setup: add `MOYASAR_WEBHOOK_SECRET` (the dashboard webhook "Secret Token"), create a webhook to `https://<domain>/api/webhooks/moyasar` for `payment_paid` and `payment_captured`, and use test keys until go-live.
- Existing database: run `npm run migrate:sar` once to make SAR the default, express rates relative to SAR, and add Moyasar to the payment methods. Review product prices afterwards: their numeric values are now interpreted as SAR.
- Why: Moyasar is the Saudi-first gateway; the provider registry keeps Stripe/PayPal/COD optional, while the webhook + callback both re-verify with the secret key so a forged client payload cannot mark an order paid. SAR as the base currency makes stored prices, checkout totals and invoices consistent.

### Verification
- Moyasar test API reachable with the configured test secret key (`GET /v1/payments` succeeded)
- `npx tsc --noEmit` — PASS
- `npm run lint` — PASS
- `npm run i18n:check` — PASS (484 keys in en-US, ar, fr)
- `npm run build` — PASS
- Live webhook later verified in P0-19; a browser-hosted checkout is still pending.

## P0-19 — Refunds, cancellations, Apple Pay (2026-10-20)

- Added `refundMoyasarPayment`/`voidMoyasarPayment` in `lib/payments/moyasar.ts` and core order logic in `lib/orders/refund-order.ts`.
- The admin order page now supports full/partial refunds, cancellation with an optional reason, refund/cancel badges, refunded totals, and a refundable-amount form. All actions are admin-only and revalidate the affected pages.
- Cancellation refunds a paid Moyasar payment, voids an authorized one, marks the order cancelled, and restores stock/sales exactly once inside a transaction. Paid COD orders can also be cancelled/restocked; the cash refund is handled manually. Stripe/PayPal refunds remain manual. Delivered, already-cancelled, and partially-refunded orders are guarded.
- Moyasar finalises a payment after one refund call, so only one full or partial refund is allowed per payment. After a partial refund, further automatic refunds and cancellation are blocked with a clear message; a fully refunded order can still be cancelled/restocked.
- The webhook now accepts `payment_refunded` (add it to the dashboard webhook) to sync dashboard-issued refunds, and paid/captured events ignore cancelled orders.
- Apple Pay is enabled in the form (`methods: ['creditcard', 'applepay', 'stcpay']` with Moyasar merchant validation). It only appears on supported Apple devices; Apple Pay and the domain must also be enabled in the Moyasar dashboard.
- BNPL is not supported by Moyasar's form (card, Apple Pay, Samsung Pay, STC Pay only). Enabling Tabby/Tamara needs a separate provider integration and merchant credentials; it remains open.

### Verification
- Full refund then cancel: payment `refunded`, order cancelled, stock/sales restored, second cancel idempotent — PASS
- Partial refund: total updated, payment finalised after one refund; second refund and cancel rejected with clear errors — PASS
- `npx tsc --noEmit` — PASS
- `npm run lint` — PASS
- `npm run i18n:check` — PASS (498 keys in en-US, ar, fr)
- `npm run build` — PASS
- Apple Pay not exercised on a physical Apple device yet.

## P0-20 — Saudi seller identity, VAT, and ZATCA Phase 1 invoices (2026-10-20)

- The default market is Saudi (`market: 'SA'`), with a new **Seller and Tax** admin section for Arabic/English legal name, VAT number, CR number, national address, seller email/phone, invoice prefix, and sequence length. All fields are editable and persisted in settings.
- Seeded seller: **NAKAA ELSEHA MEDICAL PHARMACY / صيدلية نقاء الصحة الطبية**, VAT **310161142300003**, VAT rate **15%**.
- Invoice numbering is atomic and sequential per prefix/year (`NEM-26-000001`, `NEM-26-000002`, ...). A separate counter collection and unique `number`/`orderId+type` indexes prevent duplicates; prefix/sequence length lock after the first invoice so the app cannot create an unauthorized second sequence. Invoice updates/deletes are rejected at the model layer.
- Added `Invoice`/`InvoiceCounter` models and `lib/invoices/invoice.ts`. An invoice is created once when an order is paid, with a lazy retry from the invoice page; it snapshots seller/buyer/items and stores the ZATCA QR TLV payload.
- Added `lib/invoices/qr.ts`: tags 1–5 (seller name, VAT number, timestamp in Asia/Riyadh, total incl. VAT, VAT amount), UTF-8 byte lengths, base64 TLV.
- Added `/[locale]/invoice/[id]`: printable Arabic/English invoice with seller/buyer details, line items, VAT/total, ZATCA QR, and a credit note section when a refund exists.
- Refunds/cancellations generate a credit note through the same sequence with `originalInvoiceNumber` and proportional VAT; duplicate creation is prevented.
- Admin/account order pages link to the invoice, and the purchase receipt email links to it. Invoice labels are translated in en/ar/fr.
- Migration: `npm run migrate:saudi` adds seller/invoice settings to an existing database without overwriting values. Run `npm run migrate:sar` first if not already done.
- Added `qrcode` and `@types/qrcode`.
- ZATCA Phase 2 (Fatoora) is verified at the API level in P0-21; app integration remains.

### Verification
- Invoice `NEM-26-000001` created with seller/VAT, buyer, totals; QR TLV decoded to tags 1–5 (Arabic seller name, VAT number, Riyadh timestamp, total, VAT) — PASS
- Credit note `NEM-26-000002` with original invoice reference and proportional VAT — PASS
- Re-creating an invoice returns the same number (idempotent); direct update rejected with "Invoices are immutable" — PASS
- `npm run migrate:saudi` — PASS
- `npx tsc --noEmit` — PASS
- `npm run lint` — PASS
- `npm run i18n:check` — PASS (527 keys in en-US, ar, fr)
- `npm run build` — PASS

## P0-21 — ZATCA Phase 2 (Fatoora) API verification (2026-10-20)

- Correct seller VAT is **310161142300003** (15 digits). The earlier `1185102259` was the CR number.
- Added `zatca-sdk` (MIT, pure JS) for secp256k1 keys/CSR, invoice signing, compliance/reporting/clearance, and renewal.
- Generated the EGS private key + CSR and requested a **Compliance CSID** (sandbox).
- **Compliance Invoice API**: submitted a signed B2C simplified invoice — `XSD_ZATCA_VALID`, status **PASS**, no warnings/errors.
- Issued a **Production CSID**.
- **Reporting API**: accepted a B2C simplified invoice (`accepted: true`). One warning `BR-KSA-F-08` because the developer sandbox returns a canned certificate for test CRN `886431145` / VAT `399999999900003`; the real production certificate will use CR `1185102259` / VAT `310161142300003`.
- **Production CSID Renewal API**: PASS.
- **Clearance API** was not tested because the launch scope is B2C; it will be added when B2B standard invoices are in scope.
- Private key, CSR, and CSIDs are stored in `.secrets/zatca-state.json` (gitignored). `ZATCA_*` variable names were added to `.env.example`; real values stay in `.env.local`/the secret manager.
- Next: integrate Phase 2 into invoice creation — build UBL 2.1 from the stored invoice, sign with the production CSID, report B2C invoices, persist the ICV/PIH chain, store the Phase 2 QR (tags 6–9), report credit notes, add retry/error handling, and onboard with the real production OTP.

### Verification
- Compliance CSID issued (sandbox) — PASS
- Compliance Invoice API: signed simplified invoice — PASS
- Production CSID issued — PASS
- Reporting API: simplified invoice accepted — PASS (1 sandbox-only warning)
- Production CSID renewal — PASS

## P0-22 — VAT-inclusive pricing and ZATCA Phase 2 app integration (2026-10-20)

- Prices are **VAT-inclusive by default** (`common.taxInclusive`, editable in admin). **Shipping is not taxable.**
- Products have a VAT category (`S`, `Z`, `E`, `O`) and an optional exemption reason code; only category `S` includes VAT. The admin product form exposes both fields.
- Order items snapshot `taxCategory`, `netPrice`, `vatAmount`, and `vatPercent`; orders snapshot `taxInclusive` and `taxRate`. Cart, checkout, order details, invoices, and emails show “VAT (included)”.
- Invoices store net line amounts, VAT, and the gross total. Credit notes allocate the refund across the original lines/categories, so non-taxable items and shipping are not taxed.
- Added `ZatcaSubmission` and `ZatcaChainState` models plus `lib/zatca/config.ts`, `lib/zatca/invoice-builder.ts`, and `lib/zatca/service.ts`.
- ZATCA queue signs and reports B2C invoices and credit notes, persists ICV/PIH, signed XML, invoice hash, Phase 2 QR (tags 6–9), status, warnings, and errors. Reporting failures never block a paid order; submissions stay queued/failed for admin retry.
- The invoice page renders the Phase 2 QR when available. The admin order page shows ZATCA status, ICV, hash, warnings/errors, and a retry button.
- Seller settings now include the ZATCA address fields: street, building number, district, city, postal code, country, CR, VAT, and national address.
- Production switch remains a deployment step: set `ZATCA_ENV=production`, the production `ZATCA_EGS_STATE`, live payment keys, and remove sandbox settings. Sandbox remains active until then.
- `ZATCA_EGS_STATE` was added to `.env.example`; local EGS state stays in `.secrets/` (gitignored).

### Verification
- VAT-inclusive order: 115 gross item + 10 non-taxable shipping → invoice net 100 + VAT 15 + shipping 10 = 125; ZATCA accepted.
- Credit note 5 SAR: net 4.40 + VAT 0.60, original invoice reference; ZATCA accepted.
- ICV/PIH chain: invoice ICV 1, credit note ICV 2; both accepted.
- Sandbox warning `BR-KSA-F-08` only, caused by the sandbox canned CRN; production will use CR `1185102259`.
- `npx tsc --noEmit`, `npm run lint`, `npm run i18n:check` (556 keys), `npm run build` — PASS.
- Production CSID/keys not used yet; production onboarding is deferred to deployment.

## P0-31 — Order lifecycle, stock reservations, shipping and Saudi address fields (2026-10-21)

- Added explicit order status (`pending_payment`, `paid`, `processing`, `shipped`, `delivered`, `cancelled`, `refunded`, `returned`) and append-only `statusHistory`.
- Added `StockReservation`: stock is held atomically when an order is created, committed on payment, released on cancellation, and expired after 30 minutes.
- Added `/api/cron/stock-reservations` (Bearer `CRON_SECRET`) to release expired holds; order creation also releases expired holds opportunistically.
- Added a `ShippingProvider` interface and manual provider, shipment tracking fields (`trackingNumber`, `trackingUrl`, status) and an admin "Mark as shipped" form. Delivery moves the shipment to delivered.
- Added Saudi address fields: district and national address alongside city/province/postal code.
- Admin order list shows order status; order details show the status timeline and tracking.
- Verification: `npx tsc --noEmit`, `npm run lint`, `npm run i18n:check` (704 keys), `npm test` (41 tests), `npm run build` — PASS.
- Remaining Phase 4 work: carrier adapters.

## P0-33 - Inventory alerts, audit trail and lifecycle hardening (2026-10-22)


- Added `/admin/inventory` with low-stock alerts, variant-level stock adjustments, reasons/notes, and a full adjustment history. Every adjustment records the actor, previous/new stock, source and time.

- Added `lowStockThreshold` to products, a low-stock badge on the product list, and a low-stock link on the dashboard.

- Inventory movements are now audited for manual adjustments, reservations, releases, expiry, fulfillment, cancellation and return restocking.

- Added shipment and refund/return customer emails; the account order list now shows order status and tracking.

- Fixed customer order access: owner ids are compared as strings, and admins can still open orders whose customer account was deleted.

- Hardened the lifecycle: retryable failed webhooks, idempotent delivery, COD holds that do not expire in 30 minutes, atomic release claims to prevent double restocking, in-transit cancellation blocking, stale product-save protection, server-generated order line ids, required variants for variant products, and pickup delivery-date validation.

- Restricted manual "mark as paid" to COD, fixed admin email-verification edits, required manual refund references for paid non-Moyasar cancellations, and locked product price/stock fields to their variant/inventory sources.

- Verification: `npx tsc --noEmit`, `npm run lint`, `npm run i18n:check` (770 keys), `npm test` (52 tests), `npm run build` - PASS.

## P0-32 - Admin shipping zones, rates and SMSA defaults (2026-10-21)

- Added a `ShippingRate` collection and `/admin/shipping` to manage country/region/city zones, carrier, service, flat base rate, included/extra weight, free-shipping threshold, COD fee, remote surcharge, ETA and pickup. City rules take priority over region rules, then country defaults.
- Checkout resolves the active rate from the entered Saudi address and cart weight, applies the free-shipping threshold, offers store pickup when enabled, and falls back to the existing delivery-date settings when no zone matches.
- Orders snapshot the selected rate id, zone, carrier, service, ETA, pickup location, COD fee and shipping price. Order items now snapshot variant weight for stable historical calculations.
- Added `npm run migrate:shipping` to seed SMSA flat per-city defaults (Riyadh next-day 20 SAR; outside Riyadh paid next-day/3-day and free 5-day above the store free-shipping limit); the admin table overrides them when the commercial rate card arrives. Each rate has a `freeShippingEnabled` switch, an optional basket threshold, and its own country/region/city so free shipping can differ by area and delivery speed.
- Shipping remains non-taxable. COD fees are added only for cash-on-delivery orders.
- Added `README-SHIPPING.md` with the carrier data/API checklist, rate-table shape and confirmed starting decisions.
- Verification: `npx tsc --noEmit`, `npm run lint`, `npm run i18n:check` (733 keys), `npm test` (49 tests), `npm run build` - PASS.

## P0-30 — Payment adapters, unified webhook and reconciliation (2026-10-21)

- Added `lib/payments/adapters.ts` with provider API adapters for Stripe, PayPal, Moyasar, COD and the test-only mock provider. Stripe calls now go through `lib/payments/stripe.ts`; PayPal calls go through the existing PayPal client via the adapter.
- Added `/api/webhooks/payments/{provider}` as the unified webhook entry point. Provider-specific paths remain valid for existing dashboards.
- Stripe `charge.dispute.created` / `charge.dispute.closed` events now mark the order as disputed with the dispute status; disputes are recorded in the payment event log.
- `/admin/payments` now includes reconciliation totals (gross, refunded, net), provider breakdown and disputed-order count in addition to provider status and recent events.
- Checkout payment rendering now goes through `PaymentPanel`, a provider registry; `payment-form.tsx` no longer contains PayPal/Stripe/Moyasar/COD branches.
- Webhook replay protection and event logging remain active for both Moyasar and Stripe through the shared `PaymentEvent` model.

### Verification
- `npx tsc --noEmit`, `npm run lint`, `npm run i18n:check` (694 keys), `npm test` (38 tests), `npm run build` — PASS.

## P0-29 — Payment registry, provider status and webhook event log (2026-10-21)

- Extended the payment provider registry with registry-driven availability (`getEnabledPaymentMethods`) and provider matching (`isPaymentProvider`).
- Checkout and server-side order creation now hide disabled COD and unconfigured providers through the registry.
- Added `/admin/payments`: configured/enabled status, refund capability, currencies, webhook path and recent webhook events; no secrets are exposed.
- Added `PaymentEvent` with a unique provider/event-id key, status and order reference. Moyasar events use a SHA-256 hash of the raw body; Stripe uses the signed event id. Duplicate deliveries are acknowledged without reprocessing.
- Added a test-only `mock` provider definition and registry tests.
- Remaining Phase 3 work: full creation adapters for Stripe/PayPal/COD, a single dispatcher route, and chargeback/reconciliation reporting.

### Verification
- `npx tsc --noEmit`, `npm run lint`, `npm run i18n:check` (689 keys), `npm test` (38 tests), `npm run build` — PASS.

## P0-28 — Currency rules, immutable order currency and VAT report (2026-10-21)

- Currency entries now define `locale`, `decimals`, `isBase` and `convertRate`; SAR is the base currency and conversion is display-only (base → display).
- Admin currency editor exposes locale, decimals and the base-currency marker. The base currency is normalised to exactly one entry.
- `ProductPrice` accepts explicit conversion control and currency code. Checkout, payment, order details and invoices render the **order currency** without re-converting historical orders.
- Order creation snapshots the base currency (`SAR`) rather than the currently selected display currency. Checkout warns when the display currency differs and states that orders are charged in the base currency.
- Added `/admin/reports/vat`: date-range VAT report with net sales, VAT, gross, document counts and invoice/credit-note rows. Credit notes subtract from the totals.
- Added `/api/admin/reports/vat` CSV export (admin-only) for accounting.
- `migrate:whitelabel` backfills currency metadata and the SAR base flag.
- Per-region tax rates are deferred because this deployment is single-market KSA; VAT 15%, inclusive/exclusive pricing and per-product categories are active.

### Verification
- `npx tsc --noEmit`, `npm run lint`, `npm run i18n:check` (677 keys), `npm test` (34 tests), `npm run build` — PASS.
- Currency migration verified: SAR is the only base currency, USD/EUR/AED remain display currencies.

## P0-27 — Phase 1B setup wizard, email templates and revision pass (2026-10-21)

- Added `/admin/setup`: a first-run checklist with progress for store information, brand, seller/tax, languages/currencies, shipping, payments, email identity, first published product and store publication. Each incomplete step links to the relevant admin screen.
- Added editable email templates in `Setting.emailTemplates` for receipt, review request, password reset and email verification. Each template has subject, heading, intro and footer; subjects support `{token}`, `{name}`, `{siteName}` and `{orderNumber}`.
- Email components now accept the settings content and the configured email logo. Sender, reply-to, subjects and content are resolved from settings with environment fallback.
- `migrate:whitelabel` now also backfills email templates.
- Revision pass:
  - ZATCA admin panel lists every credit note for an order, not only the first.
  - Variant SKUs/ids are validated for duplicates; admin stock field is labelled as calculated from variants.
  - Email previews follow the configured subject; verification email no longer emits an unused address.
  - Product variant reset preserves existing variants on edit.

### Verification
- `npx tsc --noEmit`, `npm run lint`, `npm run i18n:check` (660 keys), `npm test` (33 tests), `npm run build` — PASS.

## P0-26 — Per-variant SKU and stock (2026-10-21)

- Added `IProductVariant`: id, SKU, size, color, price, list price, stock, image, barcode, weight, default flag.
- Every product now normalizes to at least one default variant; legacy `sizes`/`colors`/`countInStock` remain derived from variants for compatibility.
- Admin product editor: add/remove variants, per-variant SKU, size/color, price, list price, stock, image, barcode, weight and default selection. Product totals are calculated from variants on save.
- Product page: variant selector with per-variant price, stock, image and out-of-stock label. Product cards and add-to-cart use the first in-stock/default variant.
- Cart identity is per variant, not per size/color. Order items snapshot `variantId`, `sku` and `variantLabel`, and invoices/order details show the variant.
- `buildOrderItems` validates and prices the selected variant; `fulfillOrder` atomically decrements product and variant stock.
- Returns/refunds restock the selected variant; cancellations restock every item variant. Legacy order items without a variant fall back to product-level stock.
- Added `npm run migrate:variants`: migrated 24 existing products to a default variant without changing price or stock.
- Seed data now generates default variants for every product.

### Verification
- `npx tsc --noEmit`, `npm run lint`, `npm run i18n:check` (633 keys), `npm test` (31 tests), `npm run build` — PASS.
- `npm run migrate:variants` — PASS (24 products migrated, stock preserved).

## P0-25 — CI and Phase 1A white-label essentials (2026-10-21)

- Added `.github/workflows/ci.yml`: Node 22, MongoDB service, seed, `tsc`, `lint`, `i18n:check`, `npm test`, and `build` on every PR/push to `main`.
- Extended `Setting` with `brand`, `seo`, `features`, `navigation`, and `email` sections. Defaults live in `lib/data.ts`; legacy settings are merged through `withSettingDefaults`.
- Brand: light/dark logos, favicon, email logo, primary/accent colours, font family (Geist/Cairo/System/Serif), social links.
- Theme: brand colours are injected as CSS variables into the existing Tailwind `primary` and new `brand` tokens; admin picker shows a live preview.
- Navigation: header menu and footer groups are editable in admin; the footer renders settings groups and social links.
- Feature flags: product reviews, browsing history, and cash on delivery are enforced in UI and server actions. Browsing-history links hide when the flag is off.
- Email identity: sender name/email/reply-to come from settings with `SENDER_NAME`/`SENDER_EMAIL` fallback.
- SEO: metadata title template, default description, Open Graph image, favicon, and Twitter handle come from settings.
- Added admin settings forms: Brand and Theme, SEO Defaults, Feature Flags, Navigation and Footer, Email Identity.
- `npm run migrate:whitelabel` backfills existing settings documents (brand, SEO, flags, navigation, email) using the safe defaults.
- First-run setup wizard and editable email templates remain in Phase 1B.

### Verification
- `npx tsc --noEmit`, `npm run lint`, `npm run i18n:check` (623 keys), `npm test` (29 tests), `npm run build` — PASS.
- CI YAML mirrors the local verification commands.

## P0-24 — Item-level returns/refunds and non-refundable shipping (2026-10-21)

- Products now have a `returnPolicy`: `return_and_refund`, `refund_only`, or `final_sale`. `final_sale` blocks voluntary returns and refunds.
- Each order item snapshots the product policy plus `refundedQuantity` and `restockedQuantity`, so historical orders keep their policy and cannot be refunded twice.
- Added an `OrderReturn` record per refund event with the selected items/quantities, reason, policy override, shipping amount, provider/reference, and restock status.
- Shipping rules:
  - change-of-mind return: shipping is not refunded;
  - defective or wrong item: shipping is refunded;
  - pre-delivery cancellation/seller fault: all items and shipping are refunded and all items are restocked.

- Cancellation ignores product policies (seller-side path). Returns require a delivered, paid order.

- Credit notes now contain only the selected return lines. Cancellation credit notes include all items and shipping. Multiple credit notes per order are supported; the old `{ orderId, type }` singleton index is replaced by one tax invoice per order plus one credit note per event.

- Moyasar finalises a payment after one refund call: the first return is automatic, later returns on the same payment are recorded as manual refunds. COD, Stripe and PayPal refunds are recorded manually through the same item-level flow.
 Customers cannot initiate returns/refunds.
      “First return is automatic” means:
      The admin reviews and selects the items/quantities.
      The admin clicks Process refund.
      For the first refund on a Moyasar payment, the app calls Moyasar automatically and refunds the customer.

- Admin UI: select per-item quantities, see policy badges and remaining quantities, choose a reason, enter an override reason for final-sale items, and preview items/VAT/shipping/total. Product pages, cart, order details and invoices show the policy and return state.

- Final-sale overrides for defective/wrong items are recorded but never restocked. `refund_only` items are refunded without restocking.

- Migration: `npm run migrate:returns` backfills product policies, order-item snapshots/counters, legacy credit-note event ids, and rebuilds invoice indexes. Run on the dev database: 24 products, 209 orders, indexes rebuilt.

### Verification
- `npm test` — PASS (29 tests: tax, credit notes, QR, ZATCA UBL, return policy/calculations).
- `npx tsc --noEmit`, `npm run lint`, `npm run i18n:check` (588 keys), `npm run build` — PASS.
- Manual item returns on a seeded Stripe order: two credit notes (25.07 and 27.35, no shipping) with correct net/VAT, restock-once counters, and ZATCA sandbox acceptance.
- Defective return: shipping refunded once (12.90) and included in the credit note.
- Stripe cancellation: full invoice + shipping credit note (515.32), all items restocked, ZATCA accepted.
- Sandbox submissions accepted (credit notes ICV 1–4).

## P0-23 — ZATCA onboarding/verification tooling and tax hardening (2026-10-21)

- Added `npm run zatca:onboard`: generates the EGS key/CSR, exchanges the OTP for a compliance CSID, runs the declared simplified/standard compliance checks, issues the production CSID, and writes `.secrets/zatca-state.json` (mode `0600`). It prints the base64 `ZATCA_EGS_STATE` value for the deployment environment and refuses to overwrite an existing state without `--force`.


- Added `npm run zatca:verify`: exercises the app's real path (UBL builder → sign → report) for a simplified invoice and a chained credit note. It is read-only and never advances the live ICV/PIH. Result: **invoice and credit note REPORTED** in the sandbox (ICV 3/4, net 4.40 + VAT 0.60 = 5.00 credit note).

- Sandbox caveat: the sandbox CSID returns a canned certificate registered to VAT `399999999900003`. Reporting is only allowed for that VAT. The queue rewrites the **submitted** seller VAT to the certificate VAT in sandbox only (the invoice snapshot keeps the store VAT), and `zatca:verify` does the same for its fixture. Production uses `310161142300003` and never overrides.

- Credit-note allocation is now a tested pure helper (`lib/invoices/credit-note.ts`) using integer cents and the largest-remainder method. This guarantees the credit-note total always equals the refund, never produces negative lines, and allocates non-taxable shipping correctly. Zero-value credit-note lines are dropped before ZATCA reporting.
    * Credit-note allocation: When you refund an order, the refund is divided correctly across the products and shipping.
    * Integer cents: Calculations use whole cents (e.g., 100 cents instead of $1.00) to avoid rounding errors.
    * Largest-remainder method: Any small rounding differences are distributed fairly so the total matches the exact refund.
    * No negative lines: No product or shipping line can accidentally have a negative refund amount.
    * Non-taxable shipping: Shipping refunds are handled correctly without incorrectly applying tax.
    * Zero-value lines removed: Items with a refund amount of zero are removed before sending the credit note to ZATCA.

- Legacy (pre-snapshot) orders are handled twice: `npm run migrate:tax` backfills `taxInclusive: false`, `taxRate` and per-line tax fields, and invoice creation detects the old exclusive total shape as a safety net. Per-line VAT is reconciled to the stored tax so the invoice total still equals the paid amount.

- Invoice page: net/VAT/gross columns for invoices and credit-note line items, and lazy creation now queues the ZATCA submission when fulfillment previously failed.

- Receipt/review emails show net subtotal, VAT and shipping so the rows reconcile to the gross total. The cart shows a VAT-included note.

- `npm run check:production` now parses `ZATCA_EGS_STATE`, rejects sandbox credentials, requires the production CSID, validates the VAT number, and fails on an expired certificate (warns within 30 days).

- Added `npm test` (Node test runner via `tsx`): tax pricing, credit-note allocation, QR TLV, and ZATCA UBL builder tests.

### Verification

- `npm test` — PASS (19 tests).

- `npx tsc --noEmit`, `npm run lint`, `npm run i18n:check` (558 keys), `npm run build` — PASS.

- `npm run zatca:verify` — PASS (sandbox invoice + credit note reported).

- `npm run zatca:onboard` against a throwaway state file — PASS (compliance checks + production CSID issued).

## Fix — Invalid next-intl keys (2026-10-18)

- Removed the unused `This account does not have a password set.` message key. Server-action text is returned as a plain string and is not translated.
- Renamed `If an account exists for that email, a reset link has been sent.` and `This reset link is invalid or has expired.` to versions without trailing periods, and updated the two `t(...)` call sites.
- `scripts/check-messages.mjs` now fails when any key contains `.`, because next-intl treats dots as namespace separators.
- Why: next-intl throws `INVALID_KEY` at render time, which took down every page through the locale layout.

### Verification
- `npm run i18n:check` — PASS (479 keys, no dotted keys)
- `npx tsc --noEmit` — PASS
- `npm run lint` — PASS

## Verification

### P0-1
- `npm run lint` — PASS
- `npm run i18n:check` — PASS (464 keys in en-US, ar, fr)

### P0-2
- `npx tsc --noEmit` — PASS
- `npm run lint` — PASS
- `npm run i18n:check` — PASS
- `npm run build` — PASS (on this Windows machine use `NODE_OPTIONS=--max-old-space-size=4096`; clear `.next` if a previous failed build leaves the machine low on memory)

### P0-3
- `npx tsc --noEmit` — PASS
- `npm run lint` — PASS
- `npm run i18n:check` — PASS (464 keys in en-US, ar, fr)
- `npm run build` — PASS with `NODE_OPTIONS=--max-old-space-size=4096`

### P0-4
- `npx tsc --noEmit` — PASS
- `npm run lint` — PASS
- `npm run i18n:check` — PASS (464 keys in en-US, ar, fr)
- `npm run build` — PASS with `NODE_OPTIONS=--max-old-space-size=4096`

### P0-5
- `npx tsc --noEmit` — PASS
- `npm run lint` — PASS
- `npm run i18n:check` — PASS (464 keys in en-US, ar, fr)
- `npm run build` — PASS with `NODE_OPTIONS=--max-old-space-size=4096`

### P0-6
- `npx tsc --noEmit` — PASS
- `npm run lint` — PASS
- `npm run i18n:check` — PASS (464 keys in en-US, ar, fr)
- `npm run build` — PASS with `NODE_OPTIONS=--max-old-space-size=4096`

### P0-7
- `npx tsc --noEmit` — PASS
- `npm run lint` — PASS
- `npm run i18n:check` — PASS (472 keys in en-US, ar, fr)
- `npm run build` — PASS with `NODE_OPTIONS=--max-old-space-size=4096`
- Route `/account/manage/password` is present in the build output.

### P0-8
- `npx tsc --noEmit` — PASS
- `npm run lint` — PASS
- `npm run i18n:check` — PASS (480 keys in en-US, ar, fr)
- `npm run build` — PASS with `NODE_OPTIONS=--max-old-space-size=4096`
- Routes `/forgot-password` and `/reset-password` are present in the build output.

### P0-9
- `npx tsc --noEmit` — PASS
- `npm run lint` — PASS
- `npm run i18n:check` — PASS (480 keys in en-US, ar, fr)
- `npm run build` — PASS with `NODE_OPTIONS=--max-old-space-size=4096`

### P0-10
- `npx tsc --noEmit` — PASS
- `npm run lint` — PASS
- `npm run i18n:check` — PASS (480 keys in en-US, ar, fr)
- `npm run build` — PASS with `NODE_OPTIONS=--max-old-space-size=4096`

### P0-11
- `npx tsc --noEmit` — PASS
- `npm run lint` — PASS
- `npm run i18n:check` — PASS (480 keys in en-US, ar, fr)
- `npm run build` — PASS with `NODE_OPTIONS=--max-old-space-size=4096`

### P0-12
- `npx tsc --noEmit` — PASS
- `npm run lint` — PASS
- `npm run i18n:check` — PASS (480 keys in en-US, ar, fr)
- `npm run build` — PASS with `NODE_OPTIONS=--max-old-space-size=4096`

### P0-13
- `npx tsc --noEmit` — PASS
- `npm run lint` — PASS
- `npm run i18n:check` — PASS (480 keys in en-US, ar, fr)
- `npm run build` — PASS with `NODE_OPTIONS=--max-old-space-size=4096`

### P0-14
- `npx tsc --noEmit` — PASS
- `npm run lint` — PASS
- `npm run i18n:check` — PASS (480 keys in en-US, ar, fr)
- `npm run build` — PASS with `NODE_OPTIONS=--max-old-space-size=4096` (includes the known Auth.js/`jose` Edge Runtime `CompressionStream` warning, which is not a build error)

### P0-15
- `npx tsc --noEmit` — PASS
- `npm run lint` — PASS
- `npm run i18n:check` — PASS (480 keys in en-US, ar, fr)
- `npm run build` — PASS with `NODE_OPTIONS=--max-old-space-size=4096`

---

how to open opencode in vscode:
1- open terminal in vscode
2- type ==> opencode



Bugs:
1- when entering any tags like today's deal or featured prducts ==> if browse history clicked , there is nothing to navigate to.neither a page nor a #.

2- carousel in home page.

to continue last session in opencode
in terminal in powershell type ==>  opencode
opencode --continue
then drag and drop opencode terminal from the right side to the tab area of vscode

`Ctrl + Shift + L` ==> to select all the same word from on doc 

> click tab to switch from plan to build
fixed :
1. order.actions.ts:
- addded helper fn to check if owner or admin trying to update order status
- added it in 4 fns : 
  - updateOrderStatus               - updateOrderPaymentStatus
  - updateOrderPaymentIntentId      - updateOrderPaymentMethod

2. fixed ...(await calcDeliveryDateAndPrice) in createOrderFromCart

3. fixed updateOrderToPaidByStripe fn by adding :
    - check if the order amount is the same as the stripe already payed amount
    - check if the payment intent of the payment amount is the same as the payment intent of the order chosen.

4. createPayPalOrder   approvePayPalOrder fns: add auth and DB call inside try/catch block

5. from checkout/[id]/page.tsx: removed
```tsx
  // Parallelize order fetch and auth check
  /*
  const [order, session] = await Promise.all([
    getOrderById(id),
    auth(),
  ])
  
  if (!order) notFound()

  let client_secret = null
  if (order.paymentMethod === 'Stripe' && !order.isPaid) {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(order.totalPrice * 100),
      currency: 'USD',
      metadata: { orderId: order._id },
    })
    
    await Order.findByIdAndUpdate(order._id, { stripePaymentIntentId: paymentIntent.id })

    client_secret = paymentIntent.client_secret
  }
  */

```
6. in app/[locale]/checkout/[id]/payment-form.tsx, with locations and rationale.
Why local state is needed (and where it lives)
createStripePaymentIntent is a server action called from the browser at click time, so its result arrives after the page renders. React state is the only way to (a) hold that async result and (b) re-render the Stripe <Elements> once it arrives. It must live at the top level of OrderPaymentForm — not inside CheckoutSummary — because CheckoutSummary is re-declared as a nested component each render and its own state would reset; top-level state survives and is visible to both.
Edit A — imports (line 13)
import {
  approvePayPalOrder,
  createPayPalOrder,
  createStripePaymentIntent,
} from '@/lib/actions/order.actions'
import { useState } from 'react'
Edit B — drop the clientSecret prop (lines 26–35)
Remove clientSecret from both the destructured params and the props type — the server no longer sends one.
Edit C — state (right after const { toast } = useToast(), line 49)
const [clientSecret, setClientSecret] = useState<string | null>(null)
const [isCreatingIntent, setIsCreatingIntent] = useState(false)
clientSecret: holds the returned intent secret; null until the user clicks → gates whether we show the button or the Stripe form.
isCreatingIntent: loading flag → disables the button and shows a loading label during the fetch, preventing duplicate Payment Intents.
The handler
Add after handleApprovePayPalOrder (line 80):
```tsx
const handleStripePayment = async () => {
  if (isCreatingIntent) return
  setIsCreatingIntent(true)
  const res = await createStripePaymentIntent(order._id)
  setIsCreatingIntent(false)
  if ('error' in res) {
    return toast({ description: res.error, variant: 'destructive' })
  }
  setClientSecret(res.clientSecret)
}
```
The server action returns { clientSecret } | { error }. 'error' in res narrows the union: error → toast; otherwise store the secret, which flips the render below.
The Stripe block (lines 137–147)
Replace the current && clientSecret && condition with a ternary:
```tsx
{!isPaid && paymentMethod === 'Stripe' &&
  (clientSecret ? (
    <Elements options={{ clientSecret }} stripe={stripePromise}>
      <StripeForm
        priceInCents={Math.round(order.totalPrice * 100)}
        orderId={order._id}
      />
    </Elements>
  ) : (
    <Button
      className='w-full rounded-full'
      onClick={handleStripePayment}
      disabled={isCreatingIntent}
    >
      {isCreatingIntent ? t('Submitting') : t('Stripe Checkout')}
    </Button>
  ))}
  ```
clientSecret === null → renders a "Stripe Checkout" button (mirrors the existing COD button style at line 150).
After a successful click → clientSecret is set → renders <Elements> + <StripeForm> as today.
I used existing translation keys (t('Stripe Checkout'), t('Submitting')) so no message-file changes are needed; say the word if you'd rather add a dedicated "Pay with Stripe" key to en-US.json/ar.json/fr.json.

<OrderInputSchema>(validator.ts) ==> <IOrderInput> (types/index.ts) ==> <IOrder+_id>(order.model.ts) 


--------------------------------

## Backlog

- **QStash** — `@upstash/qstash` (`package.json:36`) and `QSTASH_URL`, `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` are installed but unused. Decide between removing them or wiring a signature-verified `/api/qstash/...` endpoint (`Receiver` with the current/next signing keys) plus `Client`/`QSTASH_TOKEN` publishing for background jobs (receipts, cleanup, schedules). Do not repeat the removed unsigned `stripe-worker` pattern.

## Production TODO — Customizable Store for the Saudi Market

Goal: turn this codebase into a white-label storefront that can be configured for any store, with Arabic-first UX, SAR-first pricing, pluggable payments/shipping, strong security and operations, and a default look that is ready to publish in Saudi Arabia.

How to use: **P0** blocks launch, **P1** is required for real store operation, **P2** is scale/polish. Tick an item only after it is implemented, verified in staging, and documented.

Current baseline: credentials/Google auth, product/order/review/user/web-page admin, English/Arabic/French with RTL, settings, Stripe/PayPal/COD, uploads, emails, Redis rate limits, `tokenVersion` revocation, `sid` revocation, security hardening P0-1..P0-17.

### Phase 0 — Decisions and foundation (P0)
- [x] Store model: **one store per deployment (white-label)**. No tenant scoping is needed; each deployment has one store.
- [x] Launch payments: **Moyasar first** (Mada, Apple Pay, and STC Pay where enabled on the account). **BNPL is out of MVP.** Stripe/PayPal can stay as optional adapters.
- [x] Shipping: build **provider-agnostic endpoints now**; connect Aramex/SMSA/Saudi Post/Naqel later.
- [x] ZATCA: **Phase 1 and Phase 2 (Fatoora) are both launch-blocking.**
- [x] Catalog scope: **physical products with per-variant SKU/stock at launch**; no multiple warehouses, subscriptions, or digital products.
- [x] Confirm languages: **Arabic + English + French**; the storefront, account area, **admin UI, validation/server messages, and all emails must be fully translated** (no hardcoded English in admin/emails).
- [x] Confirm hosting: **Vercel + MongoDB Atlas + Upstash**. Domains are confirmed; record the production domain and webhook URL in the launch checklist.
- [x] Confirm email/SMS/monitoring ownership: **Zoho** for mailboxes, **Resend** for transactional email, **email-only at launch** (OTP/confirmations/communication); **4jawaly SMS is v2**, **monitoring/alerting owned by the client**.
- [x] Define the MVP launch checklist: see **MVP launch checklist** below. Launch when the legally acceptable version is complete; budget minimized.
- [x] Add Moyasar test keys to `.env.local`: `MOYASAR_PUBLISHABLE_KEY`, `MOYASAR_SECRET_KEY` (and `MOYASAR_WEBHOOK_SECRET` once the dashboard webhook exists). Never commit or paste secrets.
- [x] Add the same keys to Vercel before deployment.
- [x] Add environment validation with Zod (`lib/env.ts`) so a missing `MOYASAR_SECRET_KEY`, `UPSTASH_*`, etc. fails fast when used.
- [x] Add `.env.example` with variable names only (no values).
- [x] Add CI (GitHub Actions): `tsc --noEmit`, `lint`, `i18n:check`, unit tests, `build` on every PR.
- [x] Monitoring/error tracking/uptime: **client-owned** (Sentry/alerting to be configured by the client before launch).

### Phase 1 — Store configuration and white-label (P0/P1)
- [x] Extend `Setting` with brand (light/dark logos, favicon, email logo, colours, font, social links), SEO defaults, feature flags, navigation/footer menus, and email sender identity.
- [x] Move hardcoded brand/contact/logo strings out of the header, footer, admin/checkout layouts, metadata and email sender into settings.
- [x] Theme tokens driven by CSS variables and Tailwind; admin colour/font picker with live preview and safe defaults.
- [x] Add a first-run setup wizard: store info → currency/tax → shipping → payment → domain → first product → publish.
- [x] Add feature flags for reviews, browsing history and COD (wishlist/guest checkout/BNPL remain deferred until those features exist); maintenance mode already exists.
- [x] Make header menus, footer groups, legal pages, carousels and banners editable from `/admin`.
- [x] Add per-store email sender identity (name, email, reply-to) with environment fallback; subject, heading, intro and footer for every transactional email are editable.
- [x] Acceptance: a new store can be configured and published entirely from the admin without code edits.

### Phase 1b — Catalog and product variants (P0)
- [x] Replace the flat `sizes`/`colors` arrays with a variant model: variant id, SKU, size, color, price override, stock, image, barcode, and weight. Legacy arrays remain derived for compatibility.
- [x] Migrate existing products to a default variant without losing prices, stock, or order history (`npm run migrate:variants`).
- [x] Update the admin product editor for variants (add/edit/remove, per-variant stock, price, SKU, barcode, weight, image).
- [x] Update product cards, product page selector, cart, checkout, order items, and inventory to reference the variant id.
- [x] Enforce per-variant stock in `buildOrderItems` and `fulfillOrder`; prevent overselling.
- [x] Add per-variant image/price display and validation for required options.
- [x] Acceptance: a product with multiple size/color variants can be created, sold, refunded, and stock-tracked per variant. Review records remain product-level.

### Phase 2 — Currency, pricing, and Saudi tax (P0)
- [x] Add a base currency (`SAR`) and remove the hardcoded `USD` fallbacks (`app/[locale]/layout.tsx:106`, `lib/utils.ts:42`, order default).
- [x] Define currency rules: code, symbol, locale, decimals, rounding, and whether prices are converted or entered per currency. Conversion is display-only; SAR is the base.
- [x] Keep order totals in the order currency; never re-convert an existing order when the display currency changes.
- [x] Make VAT 15% the Saudi default and add VAT-inclusive/exclusive pricing plus per-product tax categories. Per-region rates are deferred for the single KSA market.
- [x] Add seller VAT number, CR number, national address, and Arabic/English legal name to settings.
- [x] Add ZATCA-compliant tax invoices: invoice numbering, QR TLV, simplified invoice, credit notes, Arabic + English PDF.
- [x] Add a VAT report and invoice export for accounting.
- [x] Acceptance: a SAR order produces correct totals and a compliant invoice; currency switching never changes stored totals.

### Phase 3 — Payment gateway abstraction (P0/P1)
- [x] Define a `PaymentProvider` definition/registry (id, name, currencies, refund capability, webhook path, configuration check).
- [x] Move payment-method availability behind the registry: checkout and order creation use `getEnabledPaymentMethods`; disabled COD and unconfigured providers are filtered server-side.
- [x] Extract provider API calls into adapters (`stripe`, `paypal`, `moyasar`, `cod`, `mock`). Checkout components remain provider-specific UI shells.
- [x] Store provider credentials in environment/secret manager; add `/admin/payments` showing configured/enabled providers, refund capability, currencies and webhook paths without secrets.
- [x] Add a unified webhook entry point at `/api/webhooks/payments/{provider}` while keeping provider-specific URLs for dashboard compatibility.
- [x] Implement **Moyasar** core: hosted form, Mada/card networks, Apple Pay (form enabled; dashboard domain setup required), STC Pay, callback verification, and secret-token webhook verification before fulfilling.
- [x] Add Moyasar refunds (full or one partial per payment), cancellation/void, admin UI, and refund webhook sync.
- [x] Add chargeback handling (Stripe dispute events mark orders disputed) and a provider reconciliation dashboard with gross/refunded/net totals.
- [x] Add a test-only mock provider definition for CI/registry tests; it is not exposed in the storefront checkout.
- [x] Acceptance: a new gateway can be added with an adapter, configuration, webhook mapping and one payment-panel entry; checkout/order logic no longer branches on provider internals.

### Phase 4 — Orders, inventory, and shipping (P1)
- [x] Add an explicit order state machine (`pending_payment → paid → shipped → delivered → cancelled/refunded/returned`) with immutable status history.
- [x] Reserve stock at order creation with a 30-minute expiry, release it on cancel/timeout, and commit it atomically on payment.
- [x] Add shipping zones, rates, free-shipping thresholds by region, pickup, and per-region delivery estimates.
- [x] Build the provider-agnostic shipping API now: manual shipment creation, tracking number/URL, shipment status, and a signed cron endpoint for reservation expiry. Carrier adapters are next.
- [x] Define a `ShippingProvider` interface so Aramex, SMSA, Saudi Post, and Naqel can be added later without changing checkout.
- [x] Add Saudi address fields (district, national address) alongside region/city and postal code.
- [x] Add returns/refunds workflow (item-level returns, final sale, shipping rules) and customer shipment/refund notifications.
- [x] Add low-stock alerts and inventory adjustments with an audit trail.
- [x] Acceptance: full order lifecycle is operable from admin, tracking is visible to customers, and stock can never go negative.

### Phase 5 — Security and compliance (P0)
- [ ] Add a full Content-Security-Policy allow-list for Stripe/PayPal/UploadThing/analytics, with nonce/hash support; keep `frame-ancestors`, HSTS, and `nosniff`.
- [ ] Add CSRF/origin checks for state-changing routes, secure/HttpOnly/SameSite cookies, and verify webhook signatures per provider.
- [ ] Add RBAC (owner/admin/staff/support) and enforce permissions in every server action and admin page.
- [ ] Add an audit log for admin actions (actor, action, target, timestamp, IP) and a viewer.
- [ ] Add TOTP 2FA for admins and a device/session list with per-device revocation (P0-17 is the foundation).
- [ ] Extend rate limiting to search, reviews, orders, browsing history, and public APIs; add bot protection.
- [ ] Validate and bound every payload; add file-type/size validation and malware scanning for uploads; prevent SSRF in fetches.
- [ ] PDPL: consent, privacy policy, data export/delete, retention rules, PII minimization, and encryption in transit/at rest.
- [ ] Secret rotation, least-privilege database users, dependency scanning, SAST, and a penetration test before launch.
- [ ] Confirm PCI DSS SAQ A scope by using hosted fields/redirects only; never store card data.
- [ ] Add MongoDB Atlas backups/PITR, a restore drill, and an incident-response runbook.
- [ ] Acceptance: no open P0 security findings; security checklist signed off before launch.

### Phase 6 — Efficiency and scale (P1)
- [ ] Add indexes for product slug/category/tags/isPublished/createdAt, order user+createdAt/status, review product+createdAt, and user email/role.
- [ ] Cache settings/store config and catalog reads with tag-based revalidation; avoid unnecessary per-request DB reads.
- [ ] Enforce pagination caps everywhere and use cursor pagination for large order/review lists.
- [ ] Use QStash for receipts, review requests, low-stock alerts, webhook retries, and scheduled reports (see Backlog).
- [ ] Add search with Arabic analyzers (Atlas Search or Algolia) and faceted filters.
- [ ] Optimize images (formats, sizes, CDN) and clean up unused UploadThing files.
- [ ] Add bundle analysis, code splitting, streaming/Suspense, and Arabic font subsetting.
- [ ] Add structured logs, slow-query monitoring, metrics, and alerting.
- [ ] Acceptance: performance budgets met on 4G (LCP < 2.5s, CLS < 0.1, INP < 200ms) with dashboards.

### Phase 7 — Admin control and operations (P1)
- [ ] Add a roles/permissions UI and staff accounts.
- [ ] Add a customer timeline and an order timeline with payment, refund, and shipment events.
- [ ] Add bulk product import/export (CSV/Excel), bulk edits, and inventory adjustments.
- [ ] Dashboard: sales, AOV, conversion, top products, low stock, abandoned carts, VAT report.
- [ ] Add maintenance mode, announcements, and feature-flag controls.
- [ ] Add a notification center for failed payments, refunds, low stock, and new orders.
- [ ] Document backup/restore and day-to-day operations for a non-technical operator.
- [ ] Acceptance: an operator can run daily store operations without developer help.

### Phase 8 — Default look and Saudi launch readiness (P0/P1)
- [ ] Arabic-first RTL audit of every page, including admin, emails, invoices, and error/empty states.
- [ ] Add an Arabic UI font with Latin fallback and verify Arabic line-height/letter-spacing.
- [ ] Polish the default theme: home, category, product, cart, checkout, account, auth, maintenance, 404, and emails.
- [ ] Publish Saudi legal pages in Arabic and English: privacy, terms, returns/refunds, shipping, VAT/CR, contact.
- [ ] Default to SAR, VAT 15%, Mada/Apple Pay, Saudi shipping, and COD if enabled.
- [ ] SEO: metadata, hreflang, canonical, sitemap, robots, and Product/Offer/Breadcrumb/Organization structured data.
- [ ] Accessibility audit to WCAG 2.1 AA: keyboard, focus, contrast, labels, and RTL behavior.
- [ ] Core Web Vitals budgets and mobile-first QA across common Saudi devices/networks.
- [ ] Email deliverability: SPF, DKIM, DMARC, Arabic templates, and a reputable transactional provider.
- [ ] Analytics + consent (GA4 and optional ad pixels), plus conversion tracking for checkout.
- [ ] Add a web app manifest/PWA shell if mobile installation is required.
- [ ] Launch checklist: domain/SSL, test order per provider, refund test, tax-invoice test, monitoring, backups, support contacts.
- [ ] Acceptance: a real SAR test order completes end-to-end and the default theme passes the launch checklist.

### Phase 9 — Testing and release (P0)
- [ ] Add Vitest/Jest + Testing Library; unit-test validators, pricing, currency conversion, tax, and payment adapters.
- [ ] Add integration tests for auth, orders, webhooks, and admin permissions.
- [ ] Add Playwright E2E: sign-up → product → cart → checkout (sandbox provider) → paid order → refund.
- [ ] Run CI on every PR and require green checks to merge.
- [ ] Create a staging environment with separate DB/Redis/webhook secrets and seed data.
- [ ] Load-test catalog and checkout; add post-deploy smoke tests and a rollback plan.
- [ ] Acceptance: CI is green, staging sign-off is recorded, and rollback is tested.

### Phase 10 — Multi-store/SaaS (out of scope)
Not applicable: **one store per deployment (white-label)** was chosen. Revisit only if the product changes to a SaaS/marketplace model; that would require tenant scoping on every query and strict isolation tests.

## MVP launch checklist (confirmed — in progress)

**Status: scope confirmed by the client on 2026-10-20. Implementation item 1 (Saudi seller identity, VAT, and ZATCA Phase 1 invoices) is complete; item 2 (per-variant SKU/stock) is next.**

### Confirmed MVP scope
- One white-label store, SAR-first, Arabic-first RTL with English and French.
- **Per-variant SKU/stock is required at launch** (size/color variant id, SKU, stock, price override, image, barcode, weight).
- Cart → checkout → Moyasar (Mada/card, Apple Pay, STC Pay) + COD; full/partial refunds and cancellation.
- Manual shipping zones/rates and Saudi address/phone validation; carrier integrations post-launch.
- VAT 15%, seller identity, **ZATCA Phase 1 and Phase 2 (Fatoora) both required at launch**.
- Storefront, account, checkout, admin, validation messages, and emails fully translated in ar/en/fr.
- **Email-only at launch** for OTP, order confirmations, and all customer communication. **4jawaly SMS moves to v2.**
- No BNPL at launch (it needs a separate Tabby/Tamara provider). Monitoring is client-owned.
- Launch date: **when the legally acceptable version is complete** (no fixed date). Budget: **minimized**.

### Confirmed decisions
- [x] Per-variant SKU/stock is launch-blocking.
- [x] ZATCA Phase 1 and Phase 2 (Fatoora) are both launch-blocking.
- [x] SMS provider will be **4jawaly**, but SMS is deferred to **v2**; launch uses email only for OTP/confirmations/communication.
- [x] Launch when legally acceptable; keep budget as low as possible.
- [x] BNPL is out of MVP.

### Recommended implementation order
1. [x] Seller identity, VAT 15%, and ZATCA Phase 1 invoice foundation (settings, numbering, QR TLV, Arabic/English invoice and credit note).
2. Per-variant SKU/stock across product admin, catalog, cart, checkout, orders, and fulfillment.
3. Shipping zones/rates and Saudi address/phone fields.
4. Full ar/en/fr translation of storefront, admin, validation/server messages, and emails.
5. Security P0 items and audit logging.
6. [x] ZATCA Phase 2: sandbox API flow verified and app integration complete (sign/report B2C invoices and credit notes, ICV/PIH, Phase 2 QR, retries). Real production onboarding/key switch remains a deployment step.
7. Staging E2E, legal content, launch rehearsal, and sign-off.

### A. Release and environments
- [ ] (Dev) Commit/push P0-18/P0-19, deploy a preview, and verify sign-in, product, cart, checkout, webhook, refund, and cancel.
- [ ] (Dev/Client) Add every Production env var in Vercel: Mongo, Auth, Upstash, UploadThing, Zoho/Resend, Moyasar live keys + webhook secret.
- [ ] (Dev) Merge to main only after preview sign-off; keep the previous deployment for rollback.
- [ ] (Dev) Production domain/SSL and canonical redirects; record the domain and webhook URL.
- [ ] (Dev) Atlas backup/PITR with a least-privilege DB user; Upstash production instance.
- [ ] (Dev) CI runs `tsc`, `lint`, `i18n:check`, and `build` on every PR (unit/E2E can follow).
- [ ] (Client) Monitoring, uptime checks, and alert recipients configured.

### B. Data, currency, catalog
- [ ] (Dev) Run `npm run migrate:sar` once; review every product price because numeric values are now SAR.
- [ ] (Dev/Client) Review shipping/tax settings, currency rates, store info, payment methods, and delivery dates.
- [ ] (Client) Load the final catalog: ar/en/fr names/descriptions, images, categories, stock, and publish flags.
- [ ] (Dev) Seed/verify admin/staff accounts and remove demo/test data.

### C. Payments (Moyasar / COD)
- [x] (Dev) Test keys, production webhook, and live webhook delivery verified.
- [ ] (Client/Dev) Switch Vercel to live Moyasar keys; ensure the webhook secret matches the dashboard.
- [ ] (Client) Dashboard webhook: `PAYMENT_PAID`, `PAYMENT_CAPTURED`, `PAYMENT_REFUNDED` → `https://<domain>/api/webhooks/moyasar` (HTTPS).
- [ ] (Client) Enable Apple Pay, register the production domain/merchant in Moyasar, and test on a physical iPhone.
- [ ] (Dev) Production smoke: Mada/card, STC Pay, Apple Pay (if enabled), and COD; full refund, partial refund, and cancellation.
- [ ] (Client) Confirm BNPL is out of MVP (separate Tabby/Tamara integration required).

### D. Tax, invoices, legal
- [x] (Dev) Seller identity (Arabic/English legal name, VAT `310161142300003`, CR/national address, contact), VAT 15%, and invoice prefix/sequence in admin settings.
- [x] (Dev) VAT-inclusive pricing confirmed; shipping is not taxable; non-taxable products use per-product VAT categories.
- [x] (Dev) ZATCA Phase 1 simplified tax invoice: sequential numbering, QR TLV, Arabic/English invoice page, immutable records, and credit notes for refunds.
- [x] (Dev) ZATCA Phase 2 sandbox API verification: Compliance CSID, compliance invoice, production CSID, reporting, and renewal.
- [x] (Dev) ZATCA Phase 2 app integration: build UBL 2.1 per invoice, sign/report B2C invoices, persist ICV/PIH, Phase 2 QR (tags 6-9), report credit notes, and retry/error handling.
- [x] (Dev) ZATCA onboarding/verification scripts (`zatca:onboard`, `zatca:verify`), certificate-aware production env guard, and unit tests for tax, credit notes, QR and UBL.
- [x] (Dev) Item-level returns/refunds with product return policies, non-refundable shipping, final-sale overrides, multiple credit notes, manual refund recording and `migrate:returns`.
- [ ] (Client/Dev) Switch ZATCA to production: real OTP/CSID, `ZATCA_ENV=production`, production `ZATCA_EGS_STATE`, live payment keys, and remove sandbox settings.
- [ ] (Dev) Run `npm run check:production` before deployment; it rejects sandbox ZATCA/test payment keys, missing production CSIDs and expired certificates.
- [ ] (Dev) VAT/cash reconciliation report or export for accounting.
- [ ] (Client) Publish privacy, terms, returns/refunds, shipping, contact, and VAT/CR pages in Arabic and English.

### E. Full translation (confirmed requirement)
- [ ] (Dev) Translate every storefront, account, checkout, admin, empty/error state, validation message, and server-action message into ar/en/fr.
- [ ] (Dev) Translate all emails (receipt, verification, reset, review request) and invoice/credit-note content.
- [ ] (Dev) RTL audit for admin tables/forms, emails, and invoices; Arabic font and line-height.
- [ ] (Dev) Keep `i18n:check` green and add a test/lint guard against hardcoded English in admin/emails.

### F. Orders, inventory, shipping
- [ ] (Dev) Per-variant SKU/stock: variant id, SKU, size, color, price override, stock, image, barcode, and weight; migrate existing products and enforce per-variant stock in `buildOrderItems`/`fulfillOrder`.
- [ ] (Dev) Shipping zones/rates/free-shipping threshold; Saudi region/city/district/national address and +966 validation.
- [ ] (Dev) Manual shipping provider: create shipment, tracking number, delivered/cancelled status; signed webhook for later carriers.
- [ ] (Dev) Prevent overselling and negative stock; restock exactly once on cancellation (Moyasar path done).
- [ ] (Dev) Order status timeline/history and customer notifications (paid, shipped, cancelled, refunded).

### G. Security and compliance (launch gate)
- [ ] (Dev) CSP allow-list for Moyasar CDN/API, UploadThing, and analytics; keep HSTS/nosniff/frame-ancestors.
- [ ] (Dev) CSRF/origin checks, RBAC, admin audit log, and admin 2FA.
- [ ] (Dev) Rate limits on auth/search/orders/reviews/APIs; payload/file validation; SSRF guards.
- [ ] (Dev) PDPL consent/privacy/delete/export/retention; secret rotation; dependency scan; PCI SAQ A (hosted fields only).
- [ ] (Dev) Incident-response runbook and a restore drill.

### H. QA and launch day
- [ ] (Dev/Client) Staging with separate DB/Redis/webhook secrets and seed data.
- [ ] (Dev) E2E: sign-up → product → cart → checkout → paid order → receipt email → refund/cancel → stock restored.
- [ ] (Dev/Client) Arabic/English/French RTL and mobile QA; accessibility and Core Web Vitals pass.
- [ ] (Client) Zoho/Resend SPF/DKIM/DMARC, sender identities, and transactional email tests (OTP, receipt, review, reset). SMS is v2.
- [ ] (Dev/Client) Launch day: DNS/SSL, live smoke order per enabled method, invoice, refund, monitoring, support contacts, and rollback plan.
- [ ] (Dev/Client) Sign-off: checklist complete, no open P0 security findings, and launch date recorded.

### Not in MVP (post-launch / v2)
- BNPL (Tabby/Tamara), carrier APIs (Aramex/SMSA/Saudi Post/Naqel), 4jawaly SMS, advanced analytics/dashboards, PWA shell, multi-warehouse.

### Resolved decisions (2026-10-19)
- [x] One store per deployment (white-label).
- [x] Moyasar is the first payment provider; use its test keys until go-live.
- [x] Shipping: build our provider-agnostic endpoints now; carriers later.
- [x] ZATCA Phase 1 and Phase 2 (Fatoora) are both required.
- [x] Physical products with variants; no multiple warehouses, subscriptions, or digital products at launch.

### Resolved decisions (2026-10-20)
- [x] Languages: Arabic + English + French; storefront, admin UI, server messages, and emails must be fully translated.
- [x] Hosting: Vercel + MongoDB Atlas + Upstash; domains confirmed.
- [x] Email: Zoho mailboxes with Resend for transactional email. **Email-only at launch; 4jawaly SMS is deferred to v2.**
- [x] Monitoring, error tracking, and uptime alerting are owned by the client.
- [x] Moyasar test keys are in `.env.local` and Vercel; production webhook delivery verified.
- [x] Per-variant SKU/stock is required at launch.
- [x] ZATCA Phase 1 and Phase 2 (Fatoora) are both required at launch.
- [x] Launch date: when the legally acceptable version is complete. Budget: minimized.
- [x] BNPL is out of MVP.
- [x] MVP launch checklist confirmed; see the implementation order above.

### Open decisions
None. Execution follows the confirmed implementation order above; only the final launch date remains open by design.

## Phase 4 lifecycle follow-up questions (2026-10-22)

### 1. What does “fixed COD reservations expiring after 30 minutes and losing stock” mean?

Before the fix, every stock reservation expired after 30 minutes, including cash-on-delivery orders. A COD order is created as `pending_payment` and is not paid until delivery, so the expiry cron released its stock and put it back for sale. If the same goods were sold to another customer, the admin could later fail to mark the COD order paid because there was no longer enough stock. That also blocked the invoice and delivery flow.

Now a COD reservation is created without an `expiresAt`. The expiry query only selects reservations whose `expiresAt` is a real date in the past, so a COD hold stays active until the order is paid, cancelled, deleted, or manually released.

Trade-off: an abandoned COD order keeps its stock reserved until an admin cancels it. That is intentional; it prevents overselling.

### 2. What does “made stock reserve/release transactional” mean?

Stock reservation and release now use MongoDB transactions.

- **Reserve:** all product stock decrements and the `StockReservation` document are written in one transaction. If any item lacks stock or any write fails, the whole transaction aborts, so no stock is deducted without a reservation record.
- **Release:** the reservation is claimed as `held → releasing`, every item is restocked, and the reservation is set to `released` in one transaction. If the process crashes, the transaction aborts and the reservation remains `held` for a later retry.
- **Double-release protection:** the transactional claim prevents the expiry cron and an admin cancellation from restocking the same reservation twice.
- Inventory audit rows are written only after the transaction commits.

This requires MongoDB transactions, which means a replica set or MongoDB Atlas-style deployment.

### 3. What is the webhook retry-recovery scenario?

A payment gateway can capture money successfully, but the database step can fail because of a transient MongoDB error, a stock conflict, or another temporary failure. The webhook route returns HTTP 500 so the provider retries the same event.

Previously, the second delivery found the existing `PaymentEvent` row and immediately returned HTTP 200, even when the first attempt had failed. The provider then stopped retrying, leaving a captured payment on an unpaid order.

Now, when a duplicate event arrives:

- if the existing event is `failed`, it is atomically reset to `received` and processed again;
- if the existing event is `received` and older than five minutes, it is also treated as stale and retried;
- if it is already `processed` or `ignored`, the duplicate is acknowledged without reprocessing.

Fulfillment remains idempotent because an already-paid order returns `alreadyPaid`, invoices are unique, and stock reservations are committed once.

This only helps when the provider actually retries. If it never retries, the failed event remains for investigation; there is no automatic replay job or admin replay button.

### 4. What does “blocked in-transit cancellations and duplicate delivery/refund actions” mean?

**In-transit cancellation:** if `order.shipment.status === 'in_transit'`, the server rejects cancellation and the admin UI hides the cancel action. The goods have already been handed to the carrier. Cancelling at that point would restock goods that are still moving and could still be delivered to the customer.

**Duplicate delivery:** `deliverOrder` now returns “already delivered” when the order is already delivered. It also requires the order to be paid, not cancelled, and either a shipment tracking number or a pickup order. The review email is wrapped so an email failure cannot make a successfully saved delivery look like a failure.

**Duplicate refunds:**

- The same refund request is protected by a unique `(orderId, idempotencyKey)` index. A repeated request with the same key is rejected before a second gateway refund is attempted.
- The UI disables the submit button while a refund is processing.
- Remaining item quantities and `refundedAmount` are revalidated before writing.

This is not a distributed lock for two completely different refund requests. Two different requests still rely on transaction revalidation, remaining quantities, and the gateway’s refund rules.

### 5. What are “legacy carts”?

Older carts persisted in the browser’s Zustand store may contain a product, size, and color but no `variantId`. After the per-variant migration, checkout initially rejected those lines because every product now has variants.

Checkout now resolves the line safely:

1. match the requested size/color to a real variant;
2. otherwise use the default variant;
3. otherwise use the first available variant.

The resolved variant supplies the real price, stock, SKU, weight, and image, so a legacy cart cannot buy a variant at the product-level base price. An explicitly supplied but unknown `variantId` is still rejected.

### 6. What did “fixed pickup delivery-date validation” mean?

A pickup quote has `etaMaxDays = 0`. `calculateFutureDate(0)` returned the current time, while the order schema requires `expectedDeliveryDate` to be in the future. By the time validation ran a few milliseconds later, the value was already in the past, so pickup checkout failed.

Order creation now clamps the delivery estimate to at least one day:

`calculateFutureDate(Math.max(1, etaMaxDays))`

The order therefore validates successfully. The checkout display can still show pickup as “ready today” because the quote itself has an ETA of zero; the stored expected-delivery snapshot is the next day. If desired, the pickup UI can separately display “ready today” while keeping that safe stored date.

### 7. What was fixed in admin email verification?

There were two independent bugs.

- The admin edit form received `emailVerified` as a JSON string because `getUserById` serializes the MongoDB date. The form schema expected a `Date`, so submitting an edit for any verified user failed silently. The form now converts the value to `Date` or `null` before validation.
- The server aggregation compared the submitted value to `true`. A real `Date` is never equal to `true`, so every admin edit cleared verification. The update now checks whether the submitted value is non-null: checked preserves the existing verification date or sets the current date; unchecked sets it to `null`.

This prevents an admin edit from accidentally un-verifying a customer and blocking their checkout/account access.

### 8. What refund references are required, and how are they validated?

A manual refund reference is required when the refund is not performed automatically through Moyasar.

Required cases:

- Stripe refunds;
- PayPal refunds;
- COD refunds after cash was collected;
- a second or later Moyasar refund after the first automatic refund has already been used;
- cancellation of a paid order that must be refunded manually.

The first automatic Moyasar refund does not require a manual reference because Moyasar returns its own refund identifier.

Validation today:

- **Returns/refunds:** the UI requires a non-empty reference when the refund is manual. The validator trims it and enforces a maximum of 200 characters. The server rejects an empty reference before recording the refund.
- **Cancellations:** the UI requires a non-empty reference for paid manual-refund cases and limits input to 200 characters. The server requires a non-empty trimmed value before recording the cancellation refund.

The reference is currently free-form. It is stored in `refundHistory.reference` and `OrderReturn.refundReference` for the audit trail. It is not verified against the payment gateway, because Stripe, PayPal, bank transfers, and cash payouts use different reference formats.

Possible future hardening: enforce the 200-character maximum server-side for cancellation references too, and optionally validate provider-specific prefixes only when the provider API can confirm the reference.

