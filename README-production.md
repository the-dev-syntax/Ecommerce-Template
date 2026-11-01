# Production Readiness Checklist — Essential Vital

> Status: **NOT READY FOR PUBLIC TRAFFIC** until every **P0** item and every **BLOCKER** test passes.
>
> This document is the single source of truth for the final production gate. It lists what is still missing, what must be verified, and every test that must be run before the store is opened to customers.
>
> Do not paste secrets into this file, chat, tickets or commits. Use Vercel Environment Variables or a secret manager.

## How to use this document

- **P0** = launch blocker (security, money, data loss, legal or platform failure).
- **P1** = must be completed before public traffic; may be schedulable within the first days only with a named owner and written acceptance.
- **P2** = hardening / quality; can follow launch but should be tracked.
- **BLOCKER** test = do not open the store until it passes.
- **You provide** = access, credentials, data or a decision needed from the business.
- **Pass condition** = what “done” looks like.
- Record test evidence: order IDs, payment IDs, refund IDs, screenshots, timestamps and the tester’s name.

---

## 0. Current baseline (already implemented — do not re-build)

These are present and covered by automated tests or code review. They still need the live tests listed later.


- Security: safe callback URLs, OTP via `crypto.randomInt`, per-account OTP lockout, hashed single-use reset tokens, password policy, verified-email gate inside data actions, trusted client IP handling, rate limits, session revocation, admin guards, last-admin guard, upload restricted to admins.

- Payments: Stripe webhook signature + idempotency, Moyasar token + amount/currency checks, capture recovery, PayPal capture persistence, refund/credit-note flows, restock idempotency, terminal refund status, order dedupe longer than the stock hold, shipping price/COD validation.

- Data: production seed guard, production-data readiness guard, client-bundle seed scan, indexes on orders/reviews/shipping rates, email uniqueness migration.

- Storefront: locale-aware links and pagination, real 404s for missing slugs, canonical/OG metadata per route, sitemap without double slashes, working filters/pagination, currency resolved before first paint, cart owner sync, catalogue read limiting.

- Admin: order lifecycle, inventory audit, reviews moderation, settings validation, VAT report, ZATCA queue + retry cron, setup checklist.

- Quality gates: `npm test` (148 passing), `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm run i18n:check` (805 keys), `npm run check:client-bundle`.

---

## 1. P0 — Launch blockers

### 1.1 Dependency security (critical advisory)

- [x] **PR-01 — Upgrade Next.js.** `npm audit` reported a **critical** advisory affecting `next` `10.0.0 – 15.5.27` (was `15.5.24`).
  - Done: upgraded to **`next@15.5.28`** (patched 15.x backport; `eslint-config-next` matched).
  - Test: `npm audit --omit=dev` has **zero critical/high** findings; `npx tsc --noEmit`, `npm test` (148 passing), `npm run lint`, `npm run build` and `npm run check:client-bundle` all pass.

- [x] **PR-02 — Upgrade the remaining vulnerable packages.**
  - Done: `zod@4.6.7` (migrated from zod 3; form resolvers are explicitly typed because zod 4 treats coerced inputs as `unknown`).
  - Done: `sharp@0.35.5`, `qs@6.17.1`, `postcss-selector-parser@6.1.5`, `source-map-js@1.2.2`, `decode-uri-component@0.5.1`, `brace-expansion@1.1.21` (via the `minimatch@^3` override).
  - Added npm `overrides` so transitive packages cannot regress to the vulnerable ranges.
  - Test result: `npm audit --omit=dev` -> **5 low, 0 moderate, 0 high, 0 critical**. Full audit -> **5 low, 16 moderate, 0 high, 0 critical**.
  - Accepted residual: the 5 low findings are the `resend` -> `@react-email/*` -> `html-to-text`/`deepmerge` chain (no non-breaking fix; a resend major upgrade is a separate change) and `@react-email/components` (no fix published). The 16 moderate findings are **dev-only** (`eslint`, `eslint-config-next`/`@typescript-eslint`, `react-email`/`glob`/`minimatch`). Owner: technical owner. Review again at the next dependency refresh; do not ship a dev-only package in the production bundle.

- [x] **PR-03 — Pin the Node runtime.**
  - Done: added `"engines": { "node": ">=22.0.0" }`, `.nvmrc` (`22`) and `@types/node@^22` to match the Vercel Node 22 LTS runtime.
  - Test: `npm ci` + `npx tsc --noEmit` + `npm test` + `npm run build` pass on Node `v22.13.1`.

### 1.2 Production data and settings

- [ ] **PR-04 — Fill `lib/production-data.ts`.** Every `TODO(...)` placeholder must become real data:
  - Store identity: name, slogan, description, keywords, URL, logo, email, phone, address, copyright, author.
  - Brand: dark logo, favicon, email logo, primary/accent colours, font.
  - Seller/legal: legal name (EN/AR), 15-digit VAT number, CR number, national address, street, building number, district, city, postal code, seller email/phone.
  - SEO: title template, default description, OG image, Twitter handle.
  - Email: sender name, sender email, reply-to.
  - Carousels, navigation, payment methods (only configured providers), delivery dates, shipping rates.
  - Admin user (bcrypt hash only — never plaintext) and real catalogue products.
  - Legal/CMS pages: about, contact, privacy, conditions/terms, shipping, returns.
  - Test: `npm run check:production-data` must pass with no placeholder or duplicate-slug errors.

- [ ] **PR-05 — Seed a fresh production database correctly.**
  - Action: run `npm run seed:production` only against an **empty** production database after PR-04 passes.
  - Test: admin can sign in; no demo users/orders/reviews; published catalogue and settings match the business data.

- [ ] **PR-06 — Verify all legal content exists and is linked.** Footer/header links must resolve: `/page/privacy-policy`, `/page/conditions-of-use`, `/page/returns-policy`, `/page/shipping`, `/page/about-us`, `/page/contact-us`.
  - Test: every footer/header link returns 200 in all three locales.

### 1.3 Secrets and provider onboarding

- [ ] **PR-07 — Set every production environment variable.** See the matrix in section 5. At minimum: `MONGODB_URI`, `AUTH_SECRET`, `AUTH_TRUST_HOST`, `NEXT_PUBLIC_SITE_URL`, `MOYASAR_*`, `RESEND_API_KEY`, `SENDER_EMAIL`, `SENDER_NAME`, `UPSTASH_*`, `UPLOADTHING_TOKEN`, `UPLOADTHING_SECRET`, `TAWKED_SMS_API_KEY`, `CRON_SECRET`, and any enabled Stripe/PayPal keys.
  - Test: `npm run check:production` passes; no `pk_test_`, `sk_test_`, sandbox or `tk_test_` values remain.
- [ ] **PR-08 — Complete live provider onboarding.**
  - Moyasar: live account, live publishable/secret keys, live webhook secret, Apple Pay/STC Pay enabled if offered.
  - Stripe: live keys + live webhook endpoint secret (only if enabled).
  - PayPal: live client ID/secret + live API URL (only if enabled).
  - Tawked: production/live SMS key approved for the sender/account (checkout requires a verified Saudi phone).
  - UploadThing: production token/secret and working storage.
  - Resend: verified sending domain.
  - Upstash Redis: production database/token.
  - Test: each provider’s dashboard shows the production endpoint as healthy and a live test succeeds (section 4).
- [ ] **PR-08a — Configure the production domain, DNS and TLS.**
  - Choose one canonical host (apex vs `www`) and redirect the other.
  - Point DNS at Vercel, issue/renew the certificate, and enable HSTS.
  - Set `NEXT_PUBLIC_SITE_URL` to the canonical origin with no trailing slash and redeploy (it is inlined at build time).
  - Test: both hosts resolve, the non-canonical host 308s to the canonical host, TLS is valid, and metadata/sitemap/robots/emails all use the canonical origin.
- [ ] **PR-09 — Rotate any previously exposed secrets.** Rotate the seeded/demo accounts, any key that ever appeared in a bundle, chat or commit, and bump `tokenVersion`/revoke sessions.
  - Test: old credentials no longer work; no old key is accepted by the provider.

### 1.4 ZATCA / tax compliance

- [ ] **PR-10 — Finish ZATCA production onboarding.**
  - Real 15-digit VAT number, CR, seller legal names, national address and branch data.
  - Production CSID/EGS state in `ZATCA_EGS_STATE` (never in git).
  - `ZATCA_ENV=production`; remove sandbox values after onboarding.
  - Test: `npm run check:production` passes, including the production-certificate validity check (warns if <30 days to expiry).
- [ ] **PR-11 — Verify invoices and credit notes are reported.** Pay a real small order, open `/invoice/<id>`, print/save it, and confirm the ZATCA submission status and QR.
  - Test: simplified tax invoice reported; refund produces a credit note that references the original; retry cron can recover a transient failure.

### 1.5 Email deliverability

- [ ] **PR-12 — Configure DNS for the sending domain.** SPF, DKIM and DMARC records for the Resend domain; DMARC at least `p=none` with reporting during launch, then tighten.
  - Test: send to Gmail, Outlook and a Saudi provider; check headers for `spf=pass`, `dkim=pass`, `dmarc=pass`; no spam-folder delivery.
- [ ] **PR-13 — Verify every transactional template in production.** Verification, password reset, email change, receipt, shipping update, recovery/refund, review request.
  - Test: each arrives once, links point at the canonical domain, no `//` paths, correct locale and amounts.

### 1.6 Cron and background jobs

- [ ] **PR-14 — Schedule every cron.** There is currently **no `vercel.json` cron configuration**. Either add `crons` to Vercel project config or configure an external scheduler (e.g. QStash) for:
  - `/api/cron/stock-reservations` (releases expired stock holds; run every 5–15 min).
  - `/api/cron/payment-recovery` (retries provider refunds; run every 5–15 min).
  - `/api/cron/zatca` (retries ZATCA submissions; run every 15 min).
  - Test: each route returns 401/503 without `Authorization: Bearer $CRON_SECRET` and 200 with it; confirm successful scheduled runs in logs.
- [ ] **PR-15 — Confirm QStash is either used or removed.** `@upstash/qstash` and `QSTASH_*` variables exist but no code imports QStash. Remove the unused dependency/variables or wire it deliberately.
  - Test: dependency/env audit matches the chosen design.

### 1.7 Maintenance mode

- [ ] **PR-16 — Enforce `common.isMaintenanceMode`.** The setting is editable and shown on the setup page, but **nothing in the app checks it**. Add enforcement (middleware or a server/root layout gate) that shows a maintenance page to the public while allowing admins/signed-in staff to enter.
  - Test: enable maintenance → public pages show maintenance and return a controlled status; admin can still sign in and browse; disable → normal store returns immediately (respect the settings cache TTL).

### 1.8 Backup, restore and rollback

- [ ] **PR-17 — Enable MongoDB backups/PITR.** Confirm automated snapshots and a retention window appropriate to orders/invoices.
  - Test: take a snapshot; restore to a separate database; boot the app against it; verify products, orders, invoices and indexes.
- [ ] **PR-18 — Document and test rollback.** Know the previous good deployment, the DB migration compatibility rules, and the exact rollback command.
  - Test: roll back a preview/staging deployment and confirm the store still works.

### 1.9 Monitoring and alerting

- [ ] **PR-19 — Add error monitoring.** The app has no Sentry/OpenTelemetry/log-drain or alerting. Add at least: runtime error alerts, failed-webhook alerts, failed-cron alerts, payment-recovery escalations, and a daily error digest.
  - Test: trigger a controlled server error, a failed webhook and a failed cron; confirm the right person is notified.
- [ ] **PR-20 — Add uptime and synthetic checks.** Home, product, search, sign-in and checkout entry, plus a synthetic paid-order canary in staging.
  - Test: intentionally break a route; the alert fires within the agreed SLA.

### 1.10 CI/CD and release process

- [ ] **PR-21 — Add a CI pipeline.** There is no `.github/workflows` (or equivalent). Run on every PR:
  - `npm ci`
  - `npx tsc --noEmit`
  - `npm run lint`
  - `npm test`
  - `npm run i18n:check`
  - `npm run build`
  - `npm run check:client-bundle`
  - `npm audit --omit=dev` (fail on critical/high or document an allowlist)
  - Test: a deliberately broken branch is blocked by CI.
- [ ] **PR-22 — Protect `main` and use previews.** Require review/checks, deploy previews for every PR, and promote the exact tested commit to production.
  - Test: direct push to `main` is blocked; the production deployment SHA equals the approved commit.

---

## 2. P1 — High priority before public traffic

### 2.1 Payments

- [ ] **PR-23 — Add PayPal capture reconciliation/webhook.** PayPal has no webhook handler; `approvePayPalOrder` records the capture before fulfilment, but a crash/timeout after capture and before fulfilment has no automatic reconciliation. Add a PayPal capture webhook or a reconciliation job that fetches the stored `paypalOrderId` and completes/refunds.
  - Test: capture succeeds, force fulfilment failure, run reconciliation; the order is fulfilled or refunded exactly once; no double charge.
- [ ] **PR-24 — Add a unique partial index for open orders.** Bug 63 notes the dedupe window is fixed but a unique partial index on `{ user, cartFingerprint }` for `status: 'pending_payment'` remains “future hardening”.
  - Test: two concurrent `createOrderFromCart` calls produce one open order; the loser returns the winner.

### 2.2 Admin security

- [ ] **PR-25 — Add MFA for admin accounts** (TOTP or passkey) and optionally an admin IP allowlist. Admin currently relies on password + session only.
  - Test: admin without MFA cannot access `/admin`; enrolment and recovery codes work.
- [ ] **PR-26 — Add an admin audit log.** Record role changes, settings changes, refunds, manual paid/shipped transitions and deletions with actor, timestamp and before/after values.
  - Test: every sensitive admin action appears in the audit log and is queryable.

### 2.3 Privacy and data rights (Saudi PDPL / GDPR-style)

- [ ] **PR-27 — Add self-service account deletion or a documented deletion procedure.** There is an admin-only `deleteUser`, but no customer-facing data deletion/export path.
  - Test: a customer can request deletion/export; the procedure is documented, executed and verified; legal retention for invoices/orders is respected.
- [ ] **PR-28 — Define data retention.** Orders/invoices (tax retention), browsing history, sessions, payment events, logs and marketing consent.
  - Test: retention jobs/manual procedure documented; no data kept beyond policy without a legal basis.
- [ ] **PR-29 — Add terms acceptance evidence at sign-up/checkout** if required by legal. Privacy notice is linked, but there is no timestamped acceptance record.
  - Test: acceptance is stored with version and timestamp.

### 2.4 Error handling and reliability

- [ ] **PR-30 — Stop rendering raw `error.message` in the client error boundary.** `app/[locale]/error.tsx` renders `error.message`; production server errors should show a generic message, log the detail, and offer a retry.
  - Test: force a server error; the user sees a generic message with no stack/SQL/Mongo details.
- [ ] **PR-31 — Add `app/global-error.tsx`.** Root-layout errors currently fall back to the Next.js default. Add a branded, logged global error page.
  - Test: force a root layout error; branded page renders and the event is reported.
- [ ] **PR-32 — Add a health endpoint.** Add `/api/health` (DB ping + build/version, no secrets) for uptime monitors and deploy gates.
  - Test: healthy returns 200; simulated DB failure returns 503.
- [ ] **PR-33 — Harden Redis-outage behaviour.** Decide and test fail-open vs fail-closed for each limiter/revocation path; document the chosen trade-off. Rate limits currently throw rather than degrade.
  - Test: stop Redis in staging; document which actions block and confirm the store behaves as designed.
- [ ] **PR-34 — Add email failure handling/retries.** Resend failures are logged but not retried. Add a retry/queue or a documented manual resend path for receipts/verification.
  - Test: simulate a Resend failure; the failure is visible and the email can be re-sent without duplicating side effects.

### 2.5 Observability and performance

- [ ] **PR-35 — Add structured logging with PII redaction.** Define what is logged (order id, payment id, outcome) and never log emails, phones, tokens or raw provider payloads.
  - Test: grep production logs for email/phone/token patterns after the smoke run; none appear.
- [ ] **PR-36 — Set performance budgets.** Measure Core Web Vitals for home, product, search, cart and checkout on mobile; define LCP/INP/CLS budgets and a regression check.
  - Test: Lighthouse/field data meets the agreed budget on 4G mobile.
- [ ] **PR-37 — Run an accessibility pass.** Keyboard navigation, focus states, labels, contrast, alt text, RTL for Arabic, and screen-reader checks on the critical purchase path.
  - Test: axe/Lighthouse a11y has no critical violations on the purchase path.

### 2.6 SEO and content

- [ ] **PR-38 — Add structured data (JSON-LD).** Organization, WebSite/SearchAction and Product (price, availability, rating, currency) for rich results.
  - Test: Google Rich Results Test passes for product and organization.
- [ ] **PR-39 — Remove `/cart` from the sitemap.** `app/sitemap.ts` includes `/cart` while `robots.ts` disallows it.
  - Test: sitemap contains no `//`, no private routes, and only canonical public URLs.
- [ ] **PR-40 — Add a web manifest and finalize icons.** Optional PWA/install metadata and complete favicon/apple-touch-icon set.
  - Test: manifest loads, icons resolve, no 404s.
- [ ] **PR-41 — Add `noindex` to private/thin pages** (account, checkout, cart, search result permutations) as defense in depth alongside robots rules.
  - Test: private pages emit `noindex`; public pages remain indexable.

---

## 3. P2 — Hardening / quality after launch

- [ ] **PR-41a — Verify the site in Google Search Console and Bing Webmaster Tools.** Submit `sitemap.xml`, confirm no manual actions or security issues, and check the first crawl after launch.
  - Test: sitemap is accepted; product pages are discovered; no coverage errors caused by canonical/robots rules.
- [ ] **PR-42 — Add analytics + consent categories.** If analytics/marketing pixels are added, extend the cookie-consent banner to gate them and update the privacy policy.
- [ ] **PR-43 — Add CAPTCHA/bot protection** on sign-up and contact flows if abuse appears (rate limits exist; no CAPTCHA).
- [ ] **PR-44 — Add a contact form with spam protection** (currently contact is a CMS page only).
- [ ] **PR-45 — Add saved-address UX review and address validation** (Saudi national address format, phone normalization) end-to-end.
- [ ] **PR-46 — Add inventory reconciliation report** (stock vs reservations vs sold) and a scheduled drift check.
- [ ] **PR-47 — Add shipping-carrier integration or document manual fulfilment** clearly (tracking number, carrier, customer notification).
- [ ] **PR-48 — Review multi-currency rounding and tax display** with real rates and VAT-inclusive/exclusive settings.
- [ ] **PR-49 — Review the remaining “suspected” races** (checkout state-machine edges, rate changes, variant substitution) with runtime reproduction before changing behaviour.
- [ ] **PR-50 — Remove dead code/unused dependencies** (`@upstash/qstash` if unused, commented blocks, unused settings) in a hygiene pass.

---

## 4. Test plan — every test to run

### 4.1 Automated gates (must pass on the release commit)

| ID | Command | Pass condition |
|---|---|---|
| T-A1 | `npm ci` | Reproducible clean install |
| T-A2 | `npx tsc --noEmit` | No TypeScript errors |
| T-A3 | `npm run lint` | No ESLint warnings/errors |
| T-A4 | `npm test` | All tests pass (currently 148) |
| T-A5 | `npm run i18n:check` | en-US/ar/fr key sets identical |
| T-A6 | `npm run build` | Production build succeeds |
| T-A7 | `npm run check:client-bundle` | No seed/bcrypt/email markers in client JS |
| T-A8 | `npm run check:production` | No missing/test/sandbox production values |
| T-A9 | `npm run check:production-data` | Production data has no TODO/placeholder |
| T-A10 | `npm run check:seed-data` | Development seed is valid |
| T-A11 | `npm audit --omit=dev` | No critical/high vulnerabilities, or signed allowlist |

### 4.2 Staging / sandbox tests (before production)

Use staging credentials. Never run destructive seeds against production.

| ID | Area | Test | Pass condition |
|---|---|---|---|
| T-S1 | Auth | Sign in/out, wrong password, repeated attempts | Correct session; limiter triggers |
| T-S2 | Auth | Register, OTP, resend, wrong OTP x N | OTP hashed, rate-limited, locks after N |
| T-S3 | Auth | Password reset once, reuse, expiry | One-time, expiring, no enumeration |
| T-S4 | Auth | Email change with wrong/right current password; verify new address | Changes only after OTP |
| T-S5 | Auth | Google OAuth same-email/new user (if enabled) | No dangerous linking/takeover |
| T-S6 | Auth | Session revocation one/all devices; Redis outage | Revoked session fails; documented outage behaviour |
| T-S7 | Security | Admin action/API as normal user | Rejected |
| T-S8 | Security | Upload as guest/user/admin | Only admin succeeds |
| T-S9 | Security | Bad webhook signature, wrong amount/currency | Rejected, no side effect |
| T-S10 | Security | Spoofed forwarding headers | Real client IP used |
| T-S11 | Security | Built bundle/source secret scan | No secrets/PII |
| T-S12 | Catalogue | Home, search, filters, sort, empty search, pagination | No 500s; correct results |
| T-S13 | Catalogue | Missing/unpublished product and page slugs | HTTP 404 |
| T-S14 | Catalogue | Product with variants/images/weight/stock | Correct price/stock/variant |
| T-S15 | i18n | `/ar`, `/fr`, switch locale with query/filters | Language/query preserved |
| T-S16 | Cart | Add/update/remove/reload/drawer | Correct totals, persisted |
| T-S17 | Cart | Two accounts on one browser | B never sees A’s items/address |
| T-S18 | Checkout | Saved address, phone OTP, COD/online | Correct flow and totals |
| T-S19 | Shipping | Riyadh/Jeddah/Dammam + unserved city | Correct rate/ETA; unserved rejected |
| T-S20 | Shipping | Toggle rate active/inactive | Checkout reflects immediately |
| T-S21 | Tax | VAT-inclusive/exclusive settings | Correct VAT and total |
| T-S22 | Currency | Switch and reload | Correct currency, no flash |
| T-S23 | Payments | Moyasar card sandbox | One paid order, receipt |
| T-S24 | Payments | Moyasar wallet sandbox | Wallet fulfils |
| T-S25 | Payments | Stripe sandbox + webhook | `payment_intent.succeeded` fulfils once |
| T-S26 | Payments | PayPal sandbox capture + retry | Capture stored; no double charge |
| T-S27 | Payments | Duplicate webhook replay | One fulfilment |
| T-S28 | Refunds | Admin refund (full/partial) | Gateway + order + invoice/credit note correct |
| T-S29 | Refunds | Return flow (defective/final sale) | Policy enforced; stock/refund correct |
| T-S30 | Recovery | Paid but unfulfillable order | Auto refund or `manual_review`; no double refund |
| T-S31 | Recovery | Duplicate webhook during recovery | One provider refund |
| T-S32 | Recovery | Refund then cancel/dashboard refund | No extra stock |
| T-S33 | Cron | Stock expiry, payment recovery, ZATCA | Correct retries/releases |
| T-S34 | Cron | Call without/with Bearer secret | 401/503 vs 200 |
| T-S35 | Email | All templates to real inboxes | Delivered once, correct links/locale |
| T-S36 | Email | DNS SPF/DKIM/DMARC | All pass; inbox not spam |
| T-S37 | Account | Orders, addresses, browsing history, invoices | No cross-user data/500 |
| T-S38 | Reviews | Non-buyer, buyer, moderation approve/reject | Enforced server-side |
| T-S39 | Admin | Orders lifecycle, mark paid/shipped/delivered/cancel | Correct transitions |
| T-S40 | Admin | Inventory adjust + audit | Stock/audit correct |
| T-S41 | Admin | Settings brand/tax/payment/delivery/shipping | Safe update; cache refresh |
| T-S42 | Admin | VAT report + ZATCA retry | Correct totals/status |
| T-S43 | Admin | Users role change + last-admin guard | No escalation/lockout |
| T-S44 | Admin | Maintenance mode on/off | Enforced; admin bypass works |
| T-S45 | DB | Backup + restore to separate DB | App boots; data/indexes intact |
| T-S46 | DB | Email index migration | `email_ci_unique` exists; no duplicates |
| T-S47 | Ops | Rollback deployment | Store works after rollback |
| T-S48 | Ops | Error/webhook/cron alert trigger | Correct alerts fire |
| T-S49 | Security | Inspect production response headers | HSTS, nosniff, frame protection, referrer policy, permissions policy and CSP present |
| T-S50 | Security | CSRF/origin checks on server actions and forms | Cross-origin submissions rejected |
| T-S51 | Security | Stored/reflected XSS on admin content, reviews, page Markdown and product fields | Markdown sanitized; no script execution |
| T-S52 | Security | IDOR sweep on orders, invoices, addresses and reviews across two accounts | One user cannot read another’s data |
| T-S53 | Privacy | Confirm no email/phone/token/PII in client console or server logs | No PII leakage |

### 4.3 Live production tests (small real money, immediate refund)

| ID | Area | Test | Pass condition |
|---|---|---|---|
| T-L1 | Deploy | Open production home/search/product/cart/sign-in/admin | No 500s; assets load |
| T-L2 | Domain | HTTPS, canonical host, `www`/non-`www` | Valid TLS; one canonical host |
| T-L3 | SEO | `/robots.txt`, `/sitemap.xml`, page source | Canonical domain; no localhost/preview |
| T-L4 | Auth | Admin and customer sign-in/out | Correct access |
| T-L5 | Auth | Register/verify/reset | Emails and gates work |
| T-L6 | Checkout | Real small order via Moyasar | One paid order, receipt, invoice |
| T-L7 | Checkout | Stripe/PayPal live if enabled | One paid order each |
| T-L8 | Refund | Refund the live test order | Gateway refund + credit note + email |
| T-L9 | Recovery | Controlled unfulfillable payment | Automatic refund/manual review |
| T-L10 | Webhook | Replay live webhook | Idempotent, no double effect |
| T-L11 | Cron | Observe scheduled runs in logs | All three run successfully |
| T-L12 | Rate limits | Sign-in/OTP/cart/currency abuse | Limits trigger with real IP |
| T-L13 | ZATCA | Open/print invoice, check QR/status | Reported correctly |
| T-L14 | Account switch | Two live accounts, one browser | No cart/address leakage |
| T-L15 | Locale/currency | Browse all locales, switch currency, reload | Correct locale/currency |
| T-L16 | Maintenance | Enable/disable maintenance | Public blocked; admin allowed |
| T-L17 | Backup | Confirm production snapshot exists | Restore point available |
| T-L18 | Monitoring | Check logs/alerts for 30–60 minutes | No repeating errors, secrets or PII |

### 4.4 Launch gate

Open public traffic only when all are checked:

- [ ] All P0 items closed and evidenced.
- [ ] T-A1…T-A11 pass on the production commit.
- [ ] T-S1…T-S53 pass in staging (or the documented subset with signed acceptance).
- [ ] T-L1…T-L18 pass in production with real small payments/refunds.
- [ ] Backup exists and a restore drill has been completed.
- [ ] Monitoring/alerts reach a named on-call person.
- [ ] Rollback plan and previous good deployment are known.
- [ ] Legal pages, VAT/ZATCA data and policies are live.
- [ ] Named launch owner signs off.

### 4.5 Rollback plan

- [ ] Keep the previous known-good deployment ID.
- [ ] Confirm DB migrations are backward compatible with the previous build (or document the exact restore procedure).
- [ ] If a P0 issue is found after opening: enable maintenance mode, roll back the deployment, restore the DB only if a migration is incompatible, then re-run T-L1…T-L5.
- [ ] Record the incident, root cause and follow-up in the project log.

---

## 5. Environment matrix

| Feature | Required variables | Notes |
|---|---|---|
| Core | `MONGODB_URI`, `AUTH_SECRET`, `AUTH_TRUST_HOST`, `NEXT_PUBLIC_SITE_URL` | Site URL is inlined at build time |
| Google OAuth (optional) | `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Disable if unused |
| Moyasar (default) | `MOYASAR_PUBLISHABLE_KEY`, `NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY`, `MOYASAR_SECRET_KEY`, `MOYASAR_WEBHOOK_SECRET` | Live keys only |
| Stripe (optional) | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Live keys only |
| PayPal (optional) | `PAYPAL_API_URL`, `PAYPAL_CLIENT_ID`, `PAYPAL_APP_SECRET` | Live URL only |
| Email | `RESEND_API_KEY`, `SENDER_EMAIL`, `SENDER_NAME` | Verified domain |
| SMS/phone | `TAWKED_SMS_API_KEY`, `TAWKED_API_BASE` | Live key after approval |
| Uploads | `UPLOADTHING_TOKEN`, `UPLOADTHING_SECRET` | Admin uploads |
| Rate limits/revocation | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Required for limits |
| Client IP | `TRUSTED_IP_HEADER` | `x-forwarded-for` on Vercel |
| Cron | `CRON_SECRET` | Required by all cron routes |
| ZATCA | `ZATCA_ENV=production`, `ZATCA_EGS_STATE`, EGS/CSID values | Never commit |
| Seed guard | `SEED_ALLOW_DESTRUCTIVE` | Must be unset in production |
| Legacy/optional | `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_APP_*` | Display only |

---

## 6. Clean-up list (pre-launch housekeeping)

This list is intentionally separate from the feature/bug work. These are leftovers, temporary diagnostics, dead code, stale data and old deployments that must not ship to the public store.

### 6.1 Files and documentation

- [ ] **CL-01 — Keep one source of truth for launch.** `README-production.md` is the production gate. Remove or archive the old debugging/shipping/checklist docs so nobody follows stale instructions.
- [ ] **CL-02 — Replace or remove the empty root `README.md`.** Either add a short project overview/runbook or delete the file. Do not leave a zero-content README.
- [ ] **CL-03 — Remove temporary diagnostic routes.** After the final client-IP verification, delete `app/api/debug-ip/route.ts` and any references to it.
- [ ] **CL-04 — Remove dead/commented blocks.** Examples: the commented `dbOrderWith3UserKeys`, commented `SessionProvider` wrappers, commented `console.log` lines, unreachable "No product found" blocks and shadowed variables.
- [ ] **CL-05 — Remove debug logging.** Scan for `console.log`/`console.debug` outside the seed script; keep only intentional, PII-free `console.error`/structured logs.
- [ ] **CL-06 — Remove unused assets.** Delete old logos, unused banners, sample images and orphaned files from `public/`.
- [ ] **CL-07 — Remove stale local files.** Delete `.next`, `tsconfig.tsbuildinfo`, old `.vercel` links and `.secrets/` copies from machines that do not need them (never commit them).

### 6.2 Code and dependencies

- [ ] **CL-08 — Remove unused dependencies.** Check `@upstash/qstash` (no imports), `nanoid`/`sonner`/`@types/nodemailer` if unused, and any other package not referenced by code.
- [ ] **CL-09 — Remove unused settings/features.** Delete or wire the unused commission-payment setting, `commitStockReservation`, the untyped/unused cart `init`, and any feature flag with no implementation.
- [ ] **CL-10 — Keep test-only providers out of production.** Confirm the `mock` payment provider and `/api/webhooks/payments/mock` are unreachable in production.
- [ ] **CL-11 — Remove legacy payment paths.** Confirm no `charge.succeeded` handler, no legacy PayPal capture overwrite and no old Moyasar reconciliation branch remains.
- [ ] **CL-12 — Remove comments that mention demo credentials or internal hostnames.** Including `totalena#1And4`, `admin@example.com`, `ev-web-zeta.vercel.app` and any old localhost URLs.
- [ ] **CL-13 — Re-run the dead-code scan** (`rg "TODO|FIXME|HACK|console\\.log|@ts-ignore|as any"`) and resolve or justify each hit.

### 6.3 Data cleanup

- [ ] **CL-14 — Remove demo users.** Delete `admin@example.com`, `jack@example.com`, `jane@example.com`, `user@example.com`, `user1@example.com` and any other seeded accounts from production, or rotate them to unique real credentials and revoke their sessions.
- [ ] **CL-15 — Remove demo orders/reviews.** Confirm production has no seeded paid orders, demo reviews or fake sales counts.
- [ ] **CL-16 — Remove duplicate shipping rates.** Delete duplicates that would create ambiguous quotes or delivery indexes.
- [ ] **CL-17 — Clean stale reservations and pending orders.** Release/delete abandoned `pending_payment` orders older than the reservation TTL and clear orphaned `StockReservation` rows.
- [ ] **CL-18 — Clean test webhook/payment records.** Remove test `PaymentEvent`, `OrderReturn`, recovery and ZATCA submission rows created during staging.
- [ ] **CL-19 — Clean orphaned uploads.** Remove images no longer referenced by products, pages, carousels or branding.
- [ ] **CL-20 — Verify indexes after cleanup.** Re-check order/review/shipping/email indexes and remove any duplicate rows that block a unique index.

### 6.4 Environment and deployment

- [ ] **CL-21 — Remove the manually added `VERCEL_OIDC_TOKEN`.** Vercel injects a fresh token automatically; a stored copy expires and can shadow the system value.
- [ ] **CL-22 — Remove sandbox/test variables after onboarding.** `ZATCA_SANDBOX_*`, `ZATCA_SANDBOX_OTP`, test `MOYASAR_*`/`STRIPE_*`/`PAYPAL_*` values and `SEED_ALLOW_DESTRUCTIVE`.
- [ ] **CL-23 — Remove unused env variables.** QStash variables if unused, legacy `NEXT_PUBLIC_SERVER_URL`/`SITE_URL`, and any key for a disabled provider.
- [ ] **CL-24 — Delete stale preview deployments and aliases.** Old deployments can still serve old JS bundles containing seed markers.
- [ ] **CL-25 — Remove unused domains/aliases** and keep only the canonical host plus the intentional redirect.
- [ ] **CL-26 — Confirm `.gitignore` coverage** for `.env*`, `.secrets/`, `.next/`, `node_modules/`, `.vercel/`, `*.tsbuildinfo` and generated assets.

### 6.5 Repository and release hygiene

- [ ] **CL-27 — Scan git history for secrets.** If any key/password was ever committed, rotate it and remove it from history/backups.
- [ ] **CL-28 — Delete merged/stale branches** after the release branch is merged, including temporary fix branches.
- [ ] **CL-29 — Tag the release.** Record the production commit SHA and deployment ID in the launch log.
- [ ] **CL-30 — Confirm no `TODO` remains** in production data, settings, seed files or docs.

### 6.6 Clean-up verification tests

| ID | Check | Command / action | Pass condition |
|---|---|---|---|
| T-C1 | No debug route | `curl -i https://<domain>/api/debug-ip` | 404 |
| T-C2 | No seed markers in client JS | `npm run build && npm run check:client-bundle` | `Client bundle clean` |
| T-C3 | No demo accounts | Production DB query for `@example.com` | Zero rows |
| T-C4 | No demo orders/reviews | Count orders/reviews with seed markers | Zero rows |
| T-C5 | No test/sandbox keys | `npm run check:production` | Passes with no test-key failures |
| T-C6 | No stale cron/test records | DB check for staging `PaymentEvent`/`OrderReturn`/ZATCA rows | Zero test rows |
| T-C7 | No unused env vars | Compare `.env.example` with `.env.local`/Vercel | Only intentional keys remain |
| T-C8 | No dead imports/deps | `npx tsc --noEmit`, `npm run lint`, dependency grep | Clean |
| T-C9 | No PII in logs | Grep Vercel logs for email/phone/token patterns | No matches |
| T-C10 | Sitemap/robots clean | `curl /sitemap.xml`, `curl /robots.txt` | No private routes, no `//`, canonical host |

---

## 7. Sign-off

| Role | Name | Date | Signature / approval |
|---|---|---|---|
| Store owner | | | |
| Technical owner | | | |
| Payments/operations owner | | | |
| Security/privacy owner | | | |

> Opening the store without the P0 items and the live payment/refund tests is a business risk, not a technical one. Record the decision and the named owner if anything is consciously deferred.
