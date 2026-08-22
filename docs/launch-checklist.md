# Launch checklist

What has to be true before Asaex takes a real customer's money. Ordered by what
blocks what, not by effort. Everything unticked is deliberately unticked — see
`docs/security-review.md` for why.

## Blocking — do not go live without these

- [ ] **TOTP 2FA for every staff account** (§15). Platform and office roles can
      move money and currently sign in with email and password alone.
- [ ] **Rotate the demo staff passwords.** `AsaDemo!1404` is in the repository,
      in `docs/runbook.md` and in `supabase/seed/demo.sql`. Every account in
      `*@asaex.demo` must be removed or re-credentialled before the project
      takes real traffic.
- [ ] **An independent penetration test.** The review in
      `docs/security-review.md` is white-box, by the author of the code.
- [ ] **Sanctions screening wired.** `sanctions_hits` is a table with nothing
      feeding it. §15 requires screening before go-live in this business.
- [ ] **Kavenegar credentials in place and the SMS path exercised end to end** —
      an OTP delivered to a real Iranian number, and a rate-limit hit observed.
- [ ] **A restore rehearsed from backup.** Supabase takes backups; an untested
      restore is not a backup.
- [ ] **Legal review of the compliance copy.** The platform brokers hawala
      between licensed offices (§0.10). Every screen that implies custody has to
      be corrected before, not after.
- [ ] **At least one real licensed exchange office onboarded**, with its licence
      verified and its settlement accounts confirmed by a human.
- [ ] **A second KYC reviewer exists.** `kyc_decide` enforces four eyes, so a
      single reviewer means no customer can ever be approved.

## Before the first customer

- [ ] Custom domain pointed at the deployment, HSTS preload considered, and
      `NEXT_PUBLIC_APP_URL` set to it so magic links land on the right host.
- [ ] Supabase Auth redirect allowlist updated for the production domain —
      the classic first-day failure is a sign-in link bouncing to the wrong host.
- [ ] Rate limiting in front of PostgREST for signed-in traffic.
- [ ] `pnpm audit` and a secret scanner in CI.
- [ ] Error reporting and uptime monitoring wired to somebody's phone.
- [ ] The business calendar seeded with Iranian holidays for the current year —
      the SLA engine reads `business_calendar` and an empty table means every day
      counts as a working day.
- [ ] Feature flags reviewed: corridors and offices enabled deliberately
      (§17.17), not all at once.
- [ ] `settings.p2p_limits`, `settings.customer_tiers` and
      `settings.cost_benchmark` reviewed by whoever owns pricing.
- [ ] The demo dataset removed from the production project. `supabase/seed/demo.sql`
      is idempotent and safe to re-run, which also means it is easy to leave behind.

## Already true

- [x] Every table has RLS; 21 functions are reachable from the API and every one
      re-checks its caller (`docs/security-review.md`).
- [x] No service-role key exists anywhere in the application (ADR 0010).
- [x] Money is integer minor units end to end, with the scale in the database as
      well as the client, and every movement double-entry with a per-transaction
      balance constraint.
- [x] Nothing is deleted: append-only event, ledger and audit tables; soft
      deletes everywhere else, enforced by triggers rather than convention.
- [x] Every administrative override takes a written reason and writes an audit
      row with before/after (ADR 0016).
- [x] CSP, HSTS, `frame-ancestors 'none'`, and an e2e test that fails if the
      Supabase origin drops out of `connect-src`.
- [x] WCAG 2.1 AA verified by 30 automated assertions across two locales, two
      themes and two viewports, plus a keyboard-reachability test.
- [x] A performance budget enforced in CI, per route, on gzipped bytes.
- [x] Bilingual fa/en with first-class RTL, and no hard-coded strings.
- [x] Installable PWA with an offline shell and a last-good rate snapshot.

## Day-one runbook

`docs/runbook.md` covers: bootstrapping the first account, onboarding an office,
unsticking an order, acting as an office, P2P limits, seeding demo data, key
rotation and deployment.
