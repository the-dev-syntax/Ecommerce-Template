# Actions before production

Ordered checklist of remaining manual actions. Tick each item before merging to `main` and opening the store to the public.

## 1. Debug endpoint cleanup

- [ ] After the **final production header check**, delete `app/api/debug-ip/route.ts`.
- [ ] Remove the `/api/debug-ip` reference from the P0-7 section in `README.md`.
- [ ] Deploy once more and confirm the route returns `404` (it is already inert in production, but the file should not ship to the public).
- [ ] Confirm the production response still carries the real client IP: sign in from two networks or inspect the rate-limit keys in Upstash.

## 2. Canonical URL

- [ ] `NEXT_PUBLIC_SITE_URL=https://www.essentialvital.com` is set in Production, Preview and `.env.local` (lowercase, trailing slash stripped by `getSiteUrl`).
- [ ] Redeploy — `NEXT_PUBLIC_*` values are inlined at build time, so the running deployment keeps the old value until a new build.
- [ ] After deploy, check the page source for `metadataBase`, `/sitemap.xml` and `/robots.txt`; all must use `https://www.essentialvital.com`, never `localhost` or a preview host.
- [ ] Confirm `NEXT_PUBLIC_SERVER_URL` stays deleted everywhere (it is only a legacy fallback in `lib/env.ts`).

## 3. UploadThing

- [ ] `UPLOADTHING_TOKEN` and `UPLOADTHING_SECRET` are present in Production (restored).
- [ ] On the production deployment, upload a product image in `/admin/products`, a carousel image and the site logo. All three must succeed and render.
- [ ] Confirm existing images on `utfs.io` / `*.ufs.sh` still load (the `next.config.ts` remote patterns are still required).

## 4. ZATCA (last step before production)

- [ ] Register the real company VAT number and finish ZATCA onboarding.
- [ ] Replace `ZATCA_EGS_STATE` with the production CSID/EGS state.
- [ ] Set `ZATCA_ENV=production`.
- [ ] Remove `ZATCA_SANDBOX_BASE_URL`, `ZATCA_SANDBOX_OTP`, `ZATCA_SANDBOX_PASSWORD`, `ZATCA_SANDBOX_USERNAME` after onboarding.
- [ ] Run `npm run check:production`; it must pass (`ZATCA_ENV must be "production"` currently fails by design).
- [ ] Pay one real test order, open the invoice, and confirm the ZATCA submission status and QR.

## 5. Vercel environment

- [ ] Remove the manually added `VERCEL_OIDC_TOKEN` from Vercel. Vercel injects a fresh token automatically; a stored copy expires within hours and can shadow the system value.
- [ ] `TRUSTED_IP_HEADER=x-forwarded-for` is present in Production and Preview.
- [ ] `CRON_SECRET`, `MOYASAR_*`, `UPSTASH_*` and `TAWKED_SMS_API_KEY` remain in Production.
- [ ] Add the same keys to Preview if staging tests will run there (they are currently Production-only).
- [ ] Run `npm run check:production` and `npm run check:production-data`; both must pass.

## 6. Cron and background jobs

- [ ] A scheduler calls `/api/cron/payment-recovery` every few minutes with `Authorization: Bearer $CRON_SECRET`.
- [ ] A scheduler calls `/api/cron/stock-reservations` on its interval.
- [ ] A call without the Bearer token returns `401`/`503`.
- [ ] Trigger each cron once and confirm success in the Vercel logs.

## 7. Rate limiting

- [ ] On the deployed app, trigger the sign-in limiter (30 per 10 minutes per IP) and confirm the lockout message.
- [ ] Trigger the password-reset and OTP limiters and confirm they block.
- [ ] Use a **separate staging Redis** for these tests; the production Redis shares counters with live traffic.
- [ ] Confirm a request with spoofed `CF-Connecting-IP` still resolves to the real IP (Vercel passes that header through unchanged).

## 8. Release

- [ ] Commit the P0-7 changes (`lib/client-ip.ts`, tests, `.env.example`, README, checklists, `.vercelignore`).
- [ ] Push and merge to `main`; Vercel deploys `www.essentialvital.com` from `main`.
- [ ] Verify the production deployment is the new one, not the 11-day-old build.
- [ ] Re-run the smoke checks in `tests-after-P.md` before allowing public traffic.
