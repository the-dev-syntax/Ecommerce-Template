# Tests and Requirements Just After Production, Before Public Access

> **Important verification limitation:** there is no local MongoDB and no sandbox gateway credentials in this environment, so the DB atomic claim and live Stripe/PayPal/Moyasar refund calls were not exercised end-to-end before this checklist. This document is the final live/staging gate that must be completed in production with live provider accounts before the store is opened to the public.
>
> Keep the store in maintenance/private mode until every **BLOCKER** item passes.

## How to use this list

- **BLOCKER** = do not allow public traffic until it passes.
- **You provide** = live access, credentials, a controlled test customer, and permission to make and refund a small real payment.
- **Test** = what to do in the live production system.
- **Benefit / pass condition** = why it matters and what “pass” looks like.
- Use a small real payment and refund it immediately. Do not use a customer’s real money without authorization.
- Record the payment/refund IDs, order ID, timestamps and screenshots.

---

## 0. Live access you must provide

| Service | What you provide | Used for |
|---|---|---|
| Vercel | Production project access, deployment logs, cron list, domain settings | Deploy health, logs, cron, rollback |
| Domain/DNS | Final domain access and DNS control | HTTPS, canonical URL, email links |
| MongoDB | Production DB access (read-only preferred), backup snapshot | Data checks, recovery test setup, restore |
| Stripe | Live secret/publishable keys, live webhook secret, dashboard access | Live payment/refund review |
| PayPal | Live client ID/secret, live API URL, dashboard access | Live PayPal payment/refund review |
| Moyasar | Live publishable/secret keys, live webhook secret, dashboard access | Live card/Apple Pay/STC Pay and refunds |
| Resend | Live API key, verified sender domain, test inbox | Live email delivery |
| Upstash | Live Redis URL/token | Rate limits and revocation |
| ZATCA | Production EGS/CSID and seller details | Live invoice/credit note |
| Tawked | Live API key and a controlled Saudi test phone | Live OTP |
| Test customer | Verified test email and Saudi phone | End-to-end customer journey |
| Test admin | Production admin login | Admin smoke tests |
| Payment method | A real card/wallet authorized for a small test payment | Live payment and refund |

---

## 1. Deployment and platform health — BLOCKER

| ID | Requirement / test | You provide | Test | Benefit / pass condition |
|---|---|---|---|---|
| A1 | Production deployment | Vercel access | Deploy the approved commit; open the deployment logs | Build succeeded, no runtime errors |
| A2 | Domain and HTTPS | Domain/DNS access | Open `https://your-domain`, check certificate and redirects | Valid TLS, canonical domain, no `www`/non-`www` confusion |
| A3 | Environment values | Production env | Run `npm run check:production` against production values | All required keys present; no test keys |
| A4 | Runtime health | Vercel logs | Open home, search, product, cart, sign-in, admin | No 500s or unhandled errors |
| A5 | Static assets | None | Check logo, favicon, product images, OG image | No broken images/assets |
| A6 | Canonical/robots/sitemap | Domain | Open `/robots.txt`, `/sitemap.xml`, page source | Correct public domain, not localhost/preview |
| A7 | Database connection | DB access | Open pages that query settings/products/orders | Stable connection, no timeout |
| A8 | Cron registration | Vercel cron/access | Trigger `/api/cron/stock-reservations` and `/api/cron/payment-recovery` manually | Authorized calls return success; missing secret returns 401/503 |

---

## 2. Auth, session and security — BLOCKER

| ID | Requirement / test | You provide | Test | Benefit / pass condition |
|---|---|---|---|---|
| S1 | Admin login | Production admin | Sign in, open `/admin`, sign out | Admin-only access works |
| S2 | Customer login | Test customer | Sign in, account, orders, sign out | Correct session and redirects |
| S3 | Email verification | Test inbox | Register/verify/resend/wrong code | Only verified users reach checkout/account |
| S4 | Password reset | Test inbox | Request, use once, reuse/expire | Secure one-time reset |
| S5 | Rate limits | Live proxy/Vercel | Repeated sign-in/OTP/cart/currency calls (header behaviour and limiter mechanics already verified 2026-10-31) | Limits trigger; real client IP used |
| S6 | Headers/CSP | None | Inspect production response headers | HSTS, nosniff, frame protection and CSP present |
| S7 | Webhook auth | Provider dashboards | Send bad signature/wrong amount/currency | Rejected; no order/refund action |
| S8 | Admin protection | Test user + admin | Call admin API/action as normal user | Rejected |
| S9 | Session revocation | Redis + DB | Sign out one/all devices; optionally test Redis outage | Revoked sessions fail on next request |
| S10 | Upload protection | Admin + guest | Upload as guest/user/admin | Only admin uploads succeed |
| S11 | No leaked credentials | Build/source | Check built client bundle and public source for secrets | No passwords/keys exposed |

---

## 3. Live catalogue, cart and checkout — BLOCKER

| ID | Requirement / test | You provide | Test | Benefit / pass condition |
|---|---|---|---|---|
| C1 | Home/storefront | None | Open home on desktop and mobile | Layout, images, links, locale work |
| C2 | Search/filter/sort | None | Search, category/tag/price/rating/sort, empty search | No 500s; correct results |
| C3 | Product page | None | Open simple and variant products | Correct price, stock, images and variants |
| C4 | Locale | None | Browse `/ar`, `/fr`, switch language with filters | Language/query preserved |
| C5 | Cart | Test customer | Add/update/remove, reload, open cart drawer | Correct totals, persisted cart, no stale prices |
| C6 | Address/phone | Test customer + Tawked number | Add Saudi address and verify phone | Only verified Saudi number can check out |
| C7 | Shipping | Shipping rates/settings | Checkout Riyadh/Jeddah/Dammam and an unserved city | Correct rate/ETA; unserved address rejected |
| C8 | Tax | Settings | Checkout VAT-inclusive order | Correct VAT display and total |
| C9 | Currency | Settings | Switch currency and reload | Correct currency, no misleading default flash |
| C10 | Account switch | Two test accounts | A fills cart, switch to B, check header/cart/checkout | B never sees A’s items |
| C11 | COD | Admin | Place COD order, mark paid | Correct status, stock, receipt |
| C12 | Cart/order access | Test customer | Try another customer’s order URL | Access denied |

---

## 4. Live payments — BLOCKER

Use a small real amount and refund it immediately.

| ID | Requirement / test | You provide | Test | Benefit / pass condition |
|---|---|---|---|---|
| P1 | Moyasar card | Live Moyasar keys/dashboard | Pay a small order with a real card | One paid order, receipt, invoice |
| P2 | Moyasar wallet | Moyasar live Apple Pay/STC Pay setup | Pay a small order with the supported wallet | Wallet payment fulfills correctly |
| P3 | Stripe | Live Stripe keys/webhook | Pay a small order with a Stripe card | `payment_intent.succeeded` fulfills once |
| P4 | PayPal | Live PayPal credentials | Pay/capture a small order | Capture stored; order paid once |
| P5 | Webhook delivery | Provider dashboards | Confirm the live webhook appears; replay it once | One fulfillment, duplicate acknowledged safely |
| P6 | Wrong amount/currency | Provider dashboard/CLI | Send/replay a mismatched event | Rejected; no fulfillment/refund |
| P7 | Receipt email | Resend/test inbox | After payment, check inbox | Receipt delivered once |
| P8 | Invoice/ZATCA | ZATCA production state | Open invoice; check ZATCA submission | Invoice generated and reported |
| P9 | Payment event log | DB/admin | Inspect `PaymentEvent`/order | Payment trace is recorded |

---

## 5. Live refunds and P1-11 recovery — BLOCKER

| ID | Requirement / test | You provide | Test | Benefit / pass condition |
|---|---|---|---|---|
| R1 | Normal admin refund | Provider dashboard + admin | Refund a small paid order | Correct gateway refund, order status/history, customer email |
| R2 | Full return | Test customer/admin | Return delivered order | Stock/refund/credit note correct |
| R3 | Recovery — automatic refund | Provider live keys + DB access + controlled stock | Create a test order whose stock becomes unavailable before payment (use a controlled test product), pay, let recovery run | Order becomes `refunded`; gateway shows one refund; customer gets email |
| R4 | Recovery — pending | Provider live/test capability | Force or observe a pending provider refund | Order stays `refund_pending`; cron retries; no duplicate |
| R5 | Recovery — manual review | Controlled failure (COD/mock/unsupported/refund permission) | Trigger a failure that cannot auto-refund | Order becomes `manual_review`; customer notified; staff can see it |
| R6 | Duplicate webhook during recovery | Provider replay | Send the same successful webhook twice | Only one provider refund; one final state |
| R7 | Recovery cron | Vercel cron/DB | Run `/api/cron/payment-recovery` with pending order | Retry happens; attempt limit escalates to manual review |
| R8 | Recovery email | Test inbox | Trigger refunded/pending/manual | Correct email once per outcome |
| R9 | Stock safety | DB/admin | Refund a recovery order, then run a dashboard refund/cancel | No extra stock is added |
| R10 | Refund accounting | Provider + admin | Compare provider refund, `refundedAmount`, `refundHistory`, invoice/credit note | Amounts match; no double refund |

If R3–R6 cannot pass, **do not open the store**. This is the main remaining verification gap from development.

---

## 6. Webhooks, cron and background work — BLOCKER

| ID | Requirement / test | You provide | Test | Benefit / pass condition |
|---|---|---|---|---|
| W1 | Moyasar webhook | Moyasar dashboard | Send/replay a paid/refund event | Correct order/refund; duplicate safe |
| W2 | Stripe webhook | Stripe dashboard/CLI | Send/replay `payment_intent.succeeded`/dispute | Correct order; duplicate safe |
| W3 | PayPal capture | PayPal dashboard | Complete a capture | Correct order |
| W4 | Stock expiry cron | Vercel cron | Create an unpaid order with expired reservation; run cron | Stock released once |
| W5 | Recovery cron | Vercel cron | Pending recovery order; run cron | Retried/escalated correctly |
| W6 | Cron authorization | Vercel/curl | Call with/without Bearer `CRON_SECRET` | 401/503 without; success with |
| W7 | Cron logs/alerts | Vercel logs | Cause a controlled failure | Failure is visible to the team |

---

## 7. Email, reviews and customer account — BLOCKER

| ID | Requirement / test | You provide | Test | Benefit / pass condition |
|---|---|---|---|---|
| E1 | Receipt email | Test inbox | Pay a real test order | Receipt delivered once |
| E2 | Verification/reset | Test inbox | Register/reset | Links/codes work and expire |
| E3 | Recovery email | Test inbox | Trigger refund/review | Correct message and amount |
| E4 | Review queue | Paid test customer/admin | Submit, approve/reject, edit | Only buyers can review; approval required |
| E5 | Saved addresses | Test customer | Add/edit/delete/default | Correct ownership/default |
| E6 | Browsing history | Test customer | View/clear | Only own history |
| E7 | Account pages | Test customer | Orders, addresses, manage, invoices | No 500s or cross-user data |

---

## 8. Admin and operations — BLOCKER

| ID | Requirement / test | You provide | Test | Benefit / pass condition |
|---|---|---|---|---|
| O1 | Orders | Admin | View/filter/order details; mark paid/shipped/delivered/cancel | Correct state transitions |
| O2 | Reviews | Admin | Approve/delete pending review | Storefront/rating updates |
| O3 | Inventory | Admin | Adjust stock and view audit | Stock/audit correct |
| O4 | Shipping | Admin | Add/edit/disable rate | Checkout reflects correctly |
| O5 | Settings | Admin | Change brand/tax/payment/delivery settings | Store updates safely |
| O6 | VAT report | Admin | Download CSV/date range | Correct totals |
| O7 | ZATCA | Admin | Retry invoice/credit note | Submission status visible |
| O8 | Users | Admin | Role change, last-admin guard | No privilege escalation |

---

## 9. Monitoring, backup and rollback — BLOCKER

| ID | Requirement / test | You provide | Test | Benefit / pass condition |
|---|---|---|---|---|
| M1 | Error monitoring | Vercel/log drain | Trigger controlled errors | Alerts reach the team |
| M2 | Payment/refund alerts | Provider dashboards + email/Slack | Trigger a failed webhook/refund | Correct person notified |
| M3 | Backup | DB snapshot | Confirm production backup exists | Restore point ready |
| M4 | Restore drill | Snapshot | Restore to a separate DB and boot | Recovery procedure works |
| M5 | Rollback | Vercel | Roll back to previous deployment | Store works after rollback |
| M6 | Maintenance mode | Admin | Enable/disable | Public sees maintenance page; admin can enter |
| M7 | Log review | Vercel logs | Check 30–60 minutes after tests | No repeating errors, secrets or PII |

---

## 10. Public launch gate

Do not allow public traffic until all are checked:

- [ ] A1–A8 deployment checks pass.
- [ ] S1–S11 security/auth checks pass.
- [ ] C1–C12 catalogue/cart/checkout checks pass.
- [ ] P1–P9 live payments pass.
- [ ] R1–R10 refunds and P1-11 recovery pass.
- [ ] W1–W7 webhooks/cron pass.
- [ ] E1–E7 emails/reviews/account pass.
- [ ] O1–O8 admin operations pass.
- [ ] M1–M7 monitoring/backup/rollback pass.
- [ ] Test payment/refund IDs and screenshots recorded.
- [ ] Named launch owner signs off.

### Launch owner sign-off

| Role | Name | Date | Signature/approval |
|---|---|---|---|
| Store owner |  |  |  |
| Technical owner |  |  |  |
| Payments/operations owner |  |  |  |
