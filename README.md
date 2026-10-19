# Essential Vital — Production Readiness Log

Changes are recorded here in the order they are implemented. Each point lists what changed and why.

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
- `npm run i18n:check` — PASS (479 keys in en-US, ar, fr)
- `npm run build` — PASS

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
- [ ] Choose the store model: **one store per deployment (white-label)** or **multi-tenant SaaS**. This changes the data model and every query.
- [ ] Confirm launch payment providers, merchant accounts, and the first shipping carriers.
- [ ] Confirm ZATCA scope: Phase 1 simplified invoices only, or Phase 2 Fatoora integration.
- [ ] Confirm launch languages (Arabic + English minimum) and whether the admin UI must be translated.
- [ ] Confirm hosting (Vercel + MongoDB Atlas + Upstash), domains, and monthly budget for email/SMS/monitoring.
- [ ] Define the MVP launch checklist and target date; move everything else to P1/P2.
- [ ] Add environment validation with Zod at startup (`lib/env.ts`) so a missing `STRIPE_SECRET_KEY`, `UPSTASH_*`, etc. fails fast.
- [ ] Add CI (GitHub Actions): `tsc --noEmit`, `lint`, `i18n:check`, unit tests, `build` on every PR.
- [ ] Add error tracking (Sentry) and uptime/alerting before the first real order.

### Phase 1 — Store configuration and white-label (P0/P1)
- [ ] Extend `Setting`/create a `StoreProfile` model: brand colors, light/dark logo, favicon, fonts, social links, contact, legal identity (CR/VAT), SEO defaults, and feature flags.
- [ ] Move every hardcoded brand/currency/contact string out of components into settings or translations.
- [ ] Theme tokens driven by CSS variables and Tailwind; add an admin color/font picker with live preview and a safe default theme.
- [ ] Add a first-run setup wizard: store info → currency/tax → shipping → payment → domain → first product → publish.
- [ ] Add feature flags: reviews, wishlist, browsing history, COD, BNPL, guest checkout, maintenance mode.
- [ ] Make menus, footer links, legal pages, carousels, and banners editable from `/admin`.
- [ ] Add per-store email sender identity and editable email templates (receipt, reset, verification, review request).
- [ ] Acceptance: a new store can be configured and published entirely from the admin without code edits.

### Phase 2 — Currency, pricing, and Saudi tax (P0)
- [ ] Add a base currency (`SAR`) and remove the hardcoded `USD` fallbacks (`app/[locale]/layout.tsx:106`, `lib/utils.ts:42`, order default).
- [ ] Define currency rules: code, symbol, locale, decimals, rounding, and whether prices are converted or entered per currency.
- [ ] Keep order totals in the order currency; never re-convert an existing order when the display currency changes.
- [ ] Make VAT 15% the Saudi default and add VAT-inclusive/exclusive pricing plus per-region tax rules.
- [ ] Add seller VAT number, CR number, national address, and Arabic/English legal name to settings.
- [ ] Add ZATCA-compliant tax invoices: invoice numbering, QR TLV, simplified invoice, credit notes, Arabic + English PDF.
- [ ] Add a VAT report and invoice export for accounting.
- [ ] Acceptance: a SAR order produces correct totals and a compliant invoice; currency switching never changes stored totals.

### Phase 3 — Payment gateway abstraction (P0/P1)
- [ ] Define a `PaymentProvider` interface: `createPayment`, `capture`, `refund`, `void`, `verifyWebhook`, `parseEvent`, `getStatus`, supported currencies/countries, and capabilities (partial refunds, 3DS, wallets).
- [ ] Move Stripe, PayPal, and COD into adapters behind a provider registry; remove provider-specific branches from `lib/actions/order.actions.ts`.
- [ ] Store provider credentials in environment/secret manager, not plaintext settings; add an admin screen that shows enabled providers without exposing secrets.
- [ ] Add one signature-verified webhook dispatcher with replay protection, an event log, and idempotent `fulfillOrder` calls.
- [ ] Add Saudi launch providers: Mada, Apple Pay, STC Pay, and a BNPL option (Tabby/Tamara) through the chosen PSP (Moyasar/HyperPay/PayTabs/Checkout.com).
- [ ] Add refunds, partial refunds, cancellations, chargeback handling, and payment reconciliation.
- [ ] Add a mock/test provider for CI and sandbox end-to-end tests.
- [ ] Acceptance: adding a new gateway = new adapter + config + webhook mapping, with no changes to checkout or order logic.

### Phase 4 — Orders, inventory, and shipping (P1)
- [ ] Add an explicit order state machine (pending payment → paid → processing → shipped → delivered → cancelled/refunded/returned) with immutable status history.
- [ ] Reserve stock at order creation with an expiry, release it on cancel/timeout, and keep the atomic stock decrement on payment.
- [ ] Add shipping zones, rates, free-shipping thresholds, pickup, and per-region delivery estimates.
- [ ] Add carrier adapters and tracking: Aramex, SMSA, Saudi Post, Naqel; printable labels and delivery webhooks.
- [ ] Add Saudi address fields (region, city, district, national address) and `+966` phone validation.
- [ ] Add returns/refunds workflow and customer notifications.
- [ ] Add low-stock alerts and inventory adjustments with an audit trail.
- [ ] Acceptance: full order lifecycle is operable from admin, tracking is visible to customers, and stock can never go negative.

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

### Phase 10 — Multi-store/SaaS (P2, only if Phase 0 chooses it)
- [ ] Add a `Store`/tenant model and scope every query, action, and admin view by `storeId`.
- [ ] Add per-store domains/subdomains, settings, assets, payment credentials, and email identity.
- [ ] Add tenant-aware auth/admin roles and strict isolation tests.
- [ ] Add plans/billing and per-store usage limits if the product is sold as SaaS.
- [ ] Add per-store data export and deletion.
- [ ] Acceptance: two stores on one deployment cannot read or modify each other's data.

### Open decisions (answer before Phase 1)
- [ ] One store per deployment, or multi-tenant SaaS?
- [ ] Which payment providers and merchant accounts are available at launch?
- [ ] Which shipping carriers and is COD required?
- [ ] ZATCA Phase 1 only or Phase 2 integration?
- [ ] Arabic + English only, or more languages?
- [ ] Are product variants, multiple warehouses, subscriptions, or digital products required at launch?
- [ ] What are the launch date, budget, and acceptance criteria?

