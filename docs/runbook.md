# Runbook

## Run locally

```bash
pnpm install
pnpm dev                      # live tgju data (falls back to demo automatically)
RATES_DEMO_MODE=true pnpm dev # fully offline, deterministic seeded data
```

Production: `pnpm build && pnpm start`. Env vars documented in `.env.example`.

## Rates pipeline

- Health: `GET /api/health` — provider status + tgju-vs-ECB cross deviation.
- Snapshot: `GET /api/rates` — `degraded: true` means fallback/stale; the UI
  labels it. If tgju changes shape, fix `src/lib/rates/providers/tgju.ts`
  and re-verify per `docs/integrations/tgju.md`.
- Demo mode: `RATES_DEMO_MODE=true` (CI builds always use it).

## Assets & fonts

- Regenerate the logo suite / coins / OG images: `pnpm brand:assets`
  (headless Chromium; set `CHROMIUM_PATH` if not at the default).
- Fonts are committed woff2 (Vazirmatn/Inter variable) in `src/fonts`,
  sourced from the `vazirmatn` and `@fontsource-variable/inter` packages.

## Screenshots for review

```bash
pnpm build && pnpm start &
pnpm exec tsx scripts/capture-screens.mts   # → artifacts/screens/*.png
```

## Checks

`pnpm lint` · `pnpm typecheck` · `pnpm test` (validators, money, pricing) ·
`pnpm test:e2e` (Playwright smoke, fa/en; uses demo mode). CI runs all of
them on every PR.

## Turning on real SMS

1. Set `KAVENEGAR_API_KEY` (and `KAVENEGAR_SENDER` if you use a dedicated
   line) on the app, and `SMS_PROVIDER=kavenegar`.
2. Register the OTP pattern with the gateway and put its name in
   `SMS_OTP_PATTERN` on both the app and the `send-sms-hook` Edge Function —
   Iranian gateways reject free-text one-time codes.
3. In Supabase → Authentication → Hooks, enable **Send SMS** and point it at
   the `send-sms-hook` function; copy the generated secret into the function's
   `SEND_SMS_HOOK_SECRET`.
4. Verify with a real number: `/api/auth/otp` should return `{"sent":true}`
   instead of `sms_channel_unavailable`.

Until step 3 the phone path reports `sms_channel_unavailable` and the UI says
so plainly; email sign-in works throughout.

## Promoting a KYC reviewer

Reviewers are `memberships` rows, not a flag on the profile:

```sql
insert into public.memberships (user_id, role, scope_type)
values ('<auth-user-uuid>', 'platform_compliance', 'platform');
```

Four-eyes is enforced in the database, so a queue needs **two** such people —
`kyc_decide` refuses an approval from whoever recorded the recommendation.

## Supabase (live)

Migrations in `supabase/migrations` are the §11 schema with RLS, the order
state machine (`assert_transition`), append-only guards, the balanced-ledger
trigger, and the Phase-2 additions (auth wiring, private KYC storage, OTP rate
limiting, four-eyes review). **All of them are applied** to the EU project
behind `NEXT_PUBLIC_SUPABASE_URL`. Apply locally with `supabase db reset`;
the pgTAP skeleton in `supabase/tests/rls.sql` runs via `supabase test db`.

Re-run the security linter after any schema change — it caught every finding
migration 0007 fixes.

The app holds **no service-role key** (ADR 0010): privileged work goes through
`SECURITY DEFINER` functions that check the caller's role themselves.

## Onboarding an exchange office (target flow, Phase 4)

Admin → `/admin/exchanges` wizard: legal details → license upload →
corridors → default rate config → settlement accounts → team invites →
branding → activate. Until then: insert into `exchange_offices` +
`memberships` via SQL with the same fields.

## Stuck order (target flow, Phase 3)

1. Read `order_events` for the order (append-only truth).
2. Check SLA state and the office's working hours.
3. Force-transition only via `assert_transition` with a reason — never a raw
   `UPDATE`; the ledger is corrected by compensating entries.

## Key rotation

All secrets are server-side env vars (never `NEXT_PUBLIC_`): rotate in the
host (Vercel/Supabase), redeploy, then revoke the old key at the provider.
