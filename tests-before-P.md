# Tests and Requirements Before Production

> **Important verification limitation:** there is no local MongoDB and no sandbox gateway credentials in this environment, so the DB atomic claim and live Stripe/PayPal/Moyasar refund calls were not exercised end-to-end. That must be done in staging with provider test keys before production.
>
> Use this list on a **staging** deployment with test/sandbox credentials. Never run `npm run seed` against production. `npm run seed:production` is only for a fresh production database after `lib/production-data.ts` is filled.

## How to use this list

- **BLOCKER** = do not deploy until it passes.
- **You provide** = access, credentials, accounts or data I need from you or a provider.
- **Test** = what to do.
- **Benefit / pass condition** = why it matters and what “pass” looks like.
- Provide secrets through Vercel/your secret manager, **not** in chat or committed files.

---

## 0. Access and credentials you must provide

| Service | What you provide | Used for |
|---|---|---|
| Vercel | Project access, staging environment variables, preview URL, deployment logs, cron access | Deploy, env checks, cron, logs |
| MongoDB Atlas / MongoDB host | Staging database URI, IP allowlist, backup/snapshot access | Seed, migrations, atomic recovery claim tests |
| Stripe | Test secret key, publishable key, webhook signing secret, Stripe CLI access | Stripe payment, refund, duplicate webhook tests |
| PayPal | Sandbox client ID/secret and `PAYPAL_API_URL` | PayPal payment/refund tests |
| Moyasar | Test publishable/secret keys, webhook secret, dashboard access, test Apple Pay/STC Pay setup | Moyasar payment/refund/webhook tests |
| Resend | API key, verified sender domain, test recipient email | Receipt, verification, reset and recovery emails |
| Upstash Redis | REST URL and token | Rate limits and session revocation |
| ZATCA | Sandbox/production EGS state, seller VAT/CR data, invoice prefix/sequence | Invoice and credit-note tests |
| Tawked | API key and a test Saudi mobile number you control | Phone verification tests |
| Google (optional) | OAuth test client ID/secret | Google sign-in/account-link tests |
| UploadThing (if used) | Token/secret | Admin image upload tests |
| Test customer | Email inbox and Saudi phone you control | Checkout, OTP, recovery emails |
| Test admin | Admin account and password | Admin order/review/settings tests |
| Test card / wallet | Provider test card, Apple Pay/STC Pay test setup | Payment tests |

---

## 1. Build, environment and release basics — BLOCKER

| ID | Requirement / test | You provide | Test | Benefit / pass condition |
|---|---|---|---|---|
| B1 | Clean install | Staging environment | `npm ci` | Reproducible dependency install |
| B2 | Type check | None | `npx tsc --noEmit` | No TypeScript errors |
| B3 | Lint | None | `npm run lint` | No lint errors |
| B4 | Unit/regression tests | None | `npm test` | All tests pass (currently 102) |
| B5 | Translation key check | None | `npm run i18n:check` | en-US/ar/fr key sets match |
| B6 | Production build | Free RAM on the build machine | `npm run build` (follow the Windows memory rule if building locally) | Build succeeds without heap/static-generation errors |
| B7 | Production env validation | All production env values | `npm run check:production` | No missing keys, no test/sandbox keys in production |
| B8 | Production seed data readiness | Real values in `lib/production-data.ts` | `npm run check:production-data` | No `TODO`/placeholder values, one admin, products, settings and valid defaults |
| B9 | Development seed sanity | Staging DB only | `npm run check:seed-data` | Seed data validates and has no duplicate keys |
| B10 | No secrets in the client bundle/repo | None | Search build/source for passwords, `sk_live`, `sk_test`, `totalena`, old seed emails | No credentials exposed |
| B11 | Production URL/canonical | Final domain | Confirm `NEXT_PUBLIC_SITE_URL=https://www.essentialvital.com` and `metadataBase` match the domain | No localhost or preview URL in sitemap/robots/emails |

---

## 2. Database, migrations and data — BLOCKER

| ID | Requirement / test | You provide | Test | Benefit / pass condition |
|---|---|---|---|---|
| D1 | Staging database backup | Atlas snapshot access or `mongodump` | Take a backup before any migration | Restore point exists |
| D2 | Email index migration | Staging DB access; resolve any duplicates found | `npm run migrate:email-index` | `email_ci_unique` exists; no case-variant accounts |
| D3 | Payment-recovery index | Staging DB | Confirm the order recovery index is created on deploy | Cron queries are efficient |
| D4 | Shipping-rate uniqueness (P1-18) | Decision on duplicate cleanup and staging DB access | Add/confirm the compound unique index and run the cleanup migration | No duplicate carrier/service/area rows |
| D5 | Production settings | Real seller/VAT/brand/site/contact/shipping data | Run `npm run seed:production` on an **empty** DB or create settings in admin | Store has correct legal, tax, shipping and payment data |
| D6 | Production users/products | Filled `lib/production-data.ts` | Seed once on a fresh DB, then log in as admin | No demo orders/reviews, no dev users, real catalogue |
| D7 | No demo data in production | Production DB | Count orders/reviews/users; verify no seeded demo rows | No fake paid orders or demo reviews |
| D8 | Seed guard | `SEED_ALLOW_DESTRUCTIVE` unset in production | Attempt `npm run seed` in staging with production-like env | Script refuses without `--force`; production seed refuses a non-empty DB |
| D9 | Restore drill | Backup | Restore the staging snapshot to a separate DB and boot once | Recovery procedure works |

---

## 3. Security, auth and sessions — BLOCKER

| ID | Requirement / test | You provide | Test | Benefit / pass condition |
|---|---|---|---|---|
| S1 | Sign-in/sign-out | Test customer/admin | Sign in, sign out, wrong password, repeated attempts | Correct session and rate-limit behavior |
| S2 | Password reset | Test inbox | Request reset, use the link once, reuse it, expire it | One-time, expiring, no account enumeration |
| S3 | Email verification | Test inbox | Register, enter OTP, resend, wrong OTP repeatedly | OTP hashed, rate-limited, locked after failures |
| S4 | Email change | Test inbox + current password | Change email, verify new address, try wrong password | Email changes only after verification |
| S5 | Google linking (if enabled) | Google test client | Try same-email linking and a new Google user | No dangerous account takeover/linking |
| S6 | Admin authorization | Admin and normal user | Call admin actions/API as a normal user; demote/delete admin | All admin paths reject non-admins; last admin protected |
| S7 | Session revocation | Upstash Redis + DB | Sign out one device and “sign out everywhere”; test during Redis outage if possible | Revoked session is rejected in Node and Edge paths |
| S8 | Trusted IP/rate limits (P0-7) | `TRUSTED_IP_HEADER=x-forwarded-for` is set in Production and Preview | Hit sign-in/cart/currency endpoints repeatedly; try spoofing `X-Forwarded-For`/`CF-Connecting-IP` | Limits use the real client IP and fail closed without one |
| S9 | Webhook authenticity | Provider webhook secrets | Send a bad signature, wrong amount/currency, unknown order | Rejected/logged, never fulfills or refunds |
| S10 | Upload authorization | UploadThing setup | Upload as guest/user/admin | Only admins can upload content images |
| S11 | Security headers | Vercel deployment | Inspect response headers/CSP | HSTS, nosniff, frame protection, CSP present |
| S12 | Open redirects/error leaks | None | Try `callbackUrl=https://evil.example`, malformed IDs, driver errors | No off-site redirects or internal error text |

---

## 4. Payments and P1-11 recovery — BLOCKER

| ID | Requirement / test | You provide | Test | Benefit / pass condition |
|---|---|---|---|---|
| P1 | Moyasar success | Moyasar test keys/dashboard | Pay with a test card (and Apple Pay/STC Pay if in scope) | Order paid once, receipt/invoice created |
| P2 | Stripe success | Stripe test keys + webhook secret/CLI | Pay with a Stripe test card | `payment_intent.succeeded` fulfills once |
| P3 | PayPal success | PayPal sandbox credentials | Create/capture a sandbox order | Capture ID stored; order paid once |
| P4 | COD | Staging admin | Place COD order, mark paid as admin | Correct status, stock/sales, receipt |
| P5 | Failed/cancelled payment | Provider test tools | Fail/cancel payment and retry | Order remains unpaid; no duplicate order |
| P6 | Amount/currency mismatch | Provider dashboard/CLI | Replay a webhook with a different amount/currency | Rejected; no fulfillment/refund |
| P7 | Webhook duplicate | Provider dashboard/Stripe CLI | Send the same success event 2–3 times | One payment, one order state, one refund/event |
| P8 | Recovery — successful automatic refund | Staging DB access + provider test keys | Create an order, hold stock, sell the stock elsewhere or force the reservation to expire, then pay | Order goes `refund_pending` → `refunded`; gateway shows one full refund; customer email sent |
| P9 | Recovery — pending refund | Provider sandbox that supports pending refunds, or a controlled mock | Force a refund to remain pending | Order stays `refund_pending`; no duplicate refund on retry |
| P10 | Recovery — manual review | Provider failure/test configuration | Make the refund fail definitively (e.g. unsupported/COD or invalid refund capability) | Order becomes `manual_review`; customer is notified; no money is discarded |
| P11 | Recovery — duplicate webhook during processing | Provider replay + DB access | Send the same webhook while the refund is processing | Only one provider refund call; second request returns safely |
| P12 | Recovery — stale processing retry | Staging DB | Set `recoveryRefundLastAttemptAt` to an old time and run the cron | Cron retries; no duplicate refund |
| P13 | Recovery — attempt cap | Staging DB/mock | Force repeated retryable failures | After the cap the order becomes `manual_review` |
| P14 | Recovery email | Resend test inbox | Trigger refunded, pending and manual-review outcomes | One correct customer email per outcome; no duplicates |
| P15 | Recovery stock safety | Staging DB | Refund a recovery order, then run dashboard-refund/cancel paths | No extra stock is added (no phantom inventory) |
| P16 | Refund accounting | Provider dashboard + admin order page | Compare provider refund, `refundedAmount`, `refundHistory`, credit note/invoice | Amounts match; no double refund |
| P17 | Refund permissions | Production-like provider account | Confirm the API key has refund permission | Automatic refunds work in production |

**P1-11 required staging proof:** the recovery test must cover `refunded`, `refund_pending`, `manual_review`, duplicate webhook, cron retry and customer email. A compile or unit-test-only result is not enough.

---

## 5. Orders, stock, shipping and tax — BLOCKER

| ID | Requirement / test | You provide | Test | Benefit / pass condition |
|---|---|---|---|---|
| O1 | Stock reservation TTL | Staging DB | Create unpaid order, wait/set expiry, run stock cron | Stock released exactly once |
| O2 | Payment vs expiry race | Staging DB/provider test | Pay while expiry is running | Paid order is not restocked/oversold |
| O3 | Idempotent order creation | Staging | Back button/double submit/place order twice | One order, one reservation |
| O4 | Shipping coverage | Staging shipping rates | Checkout an unserved address/COD-disabled service | Rejected with clear message, no under-priced order |
| O5 | Cancel/return/refund | Admin + test customer | Cancel unpaid/paid order; partial/full return | Correct status, stock, refund, credit note |
| O6 | Weight/rate calculation | Staging products/rates | Heavy/multi-variant order | Correct shipping surcharge |
| O7 | Invoice/ZATCA | ZATCA sandbox credentials | Pay, open invoice, retry ZATCA, issue credit note | Invoice and credit note generated/reported |
| O8 | VAT report | Admin | Export CSV for a date range | Totals match invoices/credit notes |
| O9 | Receipt/shipped/review emails | Resend test inbox | Place/pay/ship/deliver | Correct email content and no duplicates |
| O10 | Order recovery status display | Admin/customer | View recovery order in both dashboards | `refund_pending`/`manual_review` visible and understandable |

---

## 6. Customer features — BLOCKER

| ID | Requirement / test | You provide | Test | Benefit / pass condition |
|---|---|---|---|---|
| C1 | Review moderation | Customer with paid order + admin | Submit review, approve/reject in `/admin/reviews`, edit review | Only buyers can review; edits need re-approval; ratings recompute |
| C2 | Phone verification | Tawked test number | Verify, wrong OTP, rate limit, reuse | Only verified Saudi numbers can check out/save addresses |
| C3 | Saved addresses | Test customer | Add/edit/delete/default/max addresses | Correct default and ownership |
| C4 | Browsing history | Test customer | View products, sync, clear | History persists only for that user |
| C5 | Search/filter/sort | None | Search, category/tag/price/rating/sort, no results | No 500s; no-results page still usable |
| C6 | Locale navigation | None | Browse `/ar`, `/fr`, switch language with query/filters | Locale and query preserved |
| C7 | Currency display | Settings/admin | Switch currency and reload | Correct currency; no wrong-price flash (P2-31 still needs a final check) |
| C8 | Cart ownership (P3-43) | Two test accounts | Account A adds items, signs out/in as B, open header/cart/checkout | A’s items never shown to B |
| C9 | Payment success Suspense | None | Open Stripe/Moyasar success pages on a cold build | Pages render/refund states, no prerender errors |
| C10 | Mobile/desktop checkout | Browser/devtools | Complete checkout on both | Usable at launch |

---

## 7. Operations, monitoring and rollback — BLOCKER

| ID | Requirement / test | You provide | Test | Benefit / pass condition |
|---|---|---|---|---|
| M1 | Error logging | Vercel logs | Force a controlled action error | Log has context but no secrets/PII |
| M2 | Payment event log | Admin/DB | Inspect payment/recovery events | Every webhook and refund attempt is traceable |
| M3 | Cron monitoring | Vercel cron/logs | Trigger stock and recovery crons manually | Success/failure is visible; auth rejects missing secret |
| M4 | Backup/restore | Atlas snapshot | Restore staging snapshot | Documented recovery works |
| M5 | Rollback | Vercel deployment | Roll back to previous deployment | Site works after rollback |
| M6 | Maintenance mode | Admin settings | Enable/disable | Customers see maintenance page; admin access still works |
| M7 | Alert destination | Email/Slack/monitoring account | Trigger a failed payment/refund/cron | The right person is notified |

---

## 8. Open implementation / verification blockers

| ID | Item | What you provide | Test needed | Benefit |
|---|---|---|---|---|
| X1 | P1-18 shipping-rate unique index | Staging DB + decision on duplicate rows | Cleanup migration + unique compound index + retry duplicate creation | Database prevents duplicate rates |
| X2 | P3-48 Redis/Mongo revocation | Redis + DB | Revoke while Redis is down; verify Node and Edge behavior | Signed-out devices cannot stay valid |
| X3 | P3-43 global cart ownership | Two accounts/browser | Check header/cart immediately after account switch, not only checkout | No previous cart items visible |
| X4 | P0-7 trusted IP | Already configured: `TRUSTED_IP_HEADER=x-forwarded-for` | Verified 2026-10-31 on Preview: Vercel overwrites `x-forwarded-for`; `cf-connecting-ip` is spoofable and must not be used. Re-check after the next production deploy | No spoofed rate-limit bypass |
| X5 | P2-31 currency flash | Staging build/browser | Throttle CPU/reload; verify no wrong-currency price paint | No misleading price flash |
| X6 | P0-9 email migration | Staging/production DB | Run `npm run migrate:email-index` and query duplicates | Case-insensitive unique email enforcement |
| X7 | P1-11 staging E2E | Provider test keys + Mongo access | Complete the Payment recovery tests P8–P17 | Automatic refunds proven, not just unit-tested |

---

## 9. Sign-off before production

- [ ] All BLOCKER rows pass.
- [ ] Staging DB restored and production seed data reviewed.
- [ ] P1-11 recovery tested with real provider sandbox calls.
- [ ] Email/index/cron/security checks pass.
- [ ] Rollback and backup verified.
- [ ] Named owner approves the production deployment.
