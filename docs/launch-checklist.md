# Launch checklist

What has to be true before Asaex takes a real customer's money. Ordered by what
blocks what, not by effort. Everything unticked is deliberately unticked — see
`docs/security-review.md` for why.

## Blocking — do not go live without these

- [x] **Staff TOTP 2FA — built** (migration 0028). Enrolment is on the profile
      page and enforcement is in the database, not the screen: `is_platform_staff()`
      returns false for a staff account that has enrolled a factor and not answered
      it this session, so the panels empty and the RPCs refuse for the same reason.
- [ ] **Enrol every staff account, then set `require_staff_mfa` to true.** Until
      that switch is on, an account with _no_ factor still has full staff powers —
      which is deliberate, because turning it on first would lock out the only
      administrator who could turn it back off. `/admin/settings` shows who has
      enrolled. Do not flip it until that list is complete.
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

## Supabase auth settings, before offices are provisioned

- [ ] **Turn on the phone provider** (Authentication → Providers → Phone) with the
      Kavenegar credentials. Office logins are keyed to a phone number: the
      invitation flow texts credentials to a destination number and the office
      signs in with that number the first time. Until the provider is on,
      `signInWithOtp({ phone })` fails and a provisioned office cannot take up
      its invitation. Verified against the live project: phone password grants
      currently return `phone_provider_disabled`.
- [ ] **Do not rely on email sign-up.** `signUp` on the publishable key demands a
      confirmable address and goes through Supabase's shared SMTP, which is rate
      limited to a couple of messages an hour. It was tried and rejected as the
      provisioning path; see `supabase/migrations/0026_office_invitations.sql`.
- [ ] **Set `SMS_PROVIDER=kavenegar`** and the pattern names. With it unset the
      console provider logs the message and reports success, which is right for
      a test environment and wrong for a real one — an administrator would be
      told an office had been texted when nothing left the building.
