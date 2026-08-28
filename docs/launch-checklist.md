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
      administrator who could turn it back off. The roster and the switch are on
      `/admin/settings` (migration 0030); the switch stays disabled, and
      `staff_mfa_require_set` refuses and names the accounts, until every staff
      member has a factor — so this item is now a matter of enrolling people,
      not of remembering an order of operations.
- [x] **Document OCR — built** (ADR 0022), behind `kyc.ocr`. Reads the
      machine-readable zone on a phone, in the browser; nothing is written to the
      form without a press, and a reading is shown only when every ICAO check
      digit agrees. It helps passports and international ID cards. Iran's smart
      national card has no zone, so most domestic customers will still type their
      details — that is a property of the document, not a gap to close.
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

## Moving to the server

The deployment is built and proved: `docs/deploy-architecture.md` says what
runs where, `docs/deploy-runbook-fa.md` is the step-by-step for the owner, and
`deploy/` holds the compose file and ten scripts, all shellcheck-clean and
parsed in CI.

- [ ] **Run `deploy/scripts/preflight.sh` on the new server before anything
      else.** It changes nothing and answers the questions that cannot be
      answered from anywhere but that machine — above all _which container
      registry responds_, since Docker Hub refuses Iranian addresses and a
      build that discovers this half way leaves the machine part-configured.
- [ ] **Point the domain at the server and wait for `dig` to agree** before the
      first deploy. Let's Encrypt issues a certificate by reaching the name; a
      deploy run early fails at the certificate step and Caddy then backs off.
- [ ] **Fill in `DOMAIN`, `ACME_EMAIL` and `KAVENEGAR_API_KEY`** in
      `deploy/.env`, and keep a copy of that file somewhere off the machine.
      Losing it means no session and no backup can be opened again.
- [ ] **Migrate the data with `deploy/scripts/migrate-from-supabase.sh` and
      check the two counts match.** KYC document _files_ are not copied by it —
      only the rows pointing at them. Copy the bucket separately or accept that
      old documents 404 until re-uploaded.
- [ ] **Install an SSH key and re-run `harden.sh`.** It refuses to close
      password logins until a key exists, so the first run leaves that door
      open on purpose. Confirm the key works in a _second_ terminal before
      closing the first.
- [ ] **Copy a backup off the machine.** They are encrypted and verified
      nightly, and they sit on the same disk as the database they protect.
- [ ] **Set an external uptime check** on `https://<domain>/api/live`. The
      built-in watchdog runs on the server and so cannot report the server
      being down.

## Supabase auth settings, before offices are provisioned

- [x] **The phone provider is on in the self-hosted stack.** This was the item
      the hosted project could never satisfy — verified there as
      `phone_provider_disabled`. The compose file sets
      `GOTRUE_EXTERNAL_PHONE_ENABLED=true` and points GoTrue's SMS at
      Kavenegar, and the running stack reports `external.phone: true`. It still
      needs a real API key in `deploy/.env` before a message actually leaves.
- [ ] ~~Turn on the phone provider in the hosted dashboard~~ — superseded by
      the move to the server. Kept because it explains why office invitations
      could not be taken up before: Office logins are keyed to a phone number: the
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
