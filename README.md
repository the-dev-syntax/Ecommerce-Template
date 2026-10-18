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

