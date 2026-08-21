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
- Fonts live in `src/fonts` as woff2 (Vazirmatn/Inter variable). `pnpm build`
  runs `scripts/sync-fonts.mjs` first, which restores them byte-for-byte from
  the `vazirmatn` and `@fontsource-variable/inter` packages when absent, so a
  checkout without them still builds.
- The rasters are palette PNGs: flat brand gradients quantise with no visible
  banding, and the set is 96 kB rather than 841 kB.

## Screenshots for review

```bash
pnpm build && pnpm start &
pnpm exec tsx scripts/capture-screens.mts   # → artifacts/screens/*.png
```

## Checks

`pnpm lint` · `pnpm typecheck` · `pnpm test` (validators, money, pricing,
Jalali, phone) · `pnpm test:e2e` (Playwright smoke, fa/en; uses demo mode). CI
runs all of them on every PR.

The smoke suite pins the CSP: the browser talks to Supabase directly for RLS
reads, KYC uploads and signed document URLs, so `connect-src`/`img-src` have to
name the project origin. A policy of `'self'` alone breaks authenticated flows
in production only, which is exactly the failure a test has to catch.

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

## Deploying to Vercel

The project is a stock Next.js app — Vercel needs no build configuration beyond
what is in the repo:

| Setting   | Value                                                           |
| --------- | --------------------------------------------------------------- |
| Framework | Next.js (auto-detected)                                         |
| Install   | `pnpm install` (`packageManager` pins pnpm 10)                  |
| Build     | `pnpm build` — runs `scripts/sync-fonts.mjs`, then `next build` |
| Node      | 20+ (`engines.node`)                                            |

`.env.production` is committed and carries the publishable Supabase URL and key,
so a fresh deploy comes up wired to the live database with no dashboard step.
Real environment variables override it, which is how the production host and any
server-only secret (`KAVENEGAR_API_KEY`, `RESEND_API_KEY`) get set later.

**Linking the repository requires the Vercel GitHub App**, installed once by the
account owner at <https://github.com/apps/vercel> with access granted to this
repository. Without it the Vercel API refuses to create the project:

```
400 bad_request — To link a GitHub repository, you need to install the
GitHub integration first.
```

After installing it, create the project against `Sinaaghaahmadi/q`; every push
to the branch then deploys on its own, and merges to the default branch go to
production.

Set `NEXT_PUBLIC_APP_URL` to the deployment's own origin once it exists —
`metadataBase` falls back to `http://localhost:3000`, which makes OG image URLs
in the page head absolute against the wrong host.

Two Supabase settings need the deployed origin as well: **Authentication → URL
Configuration → Site URL**, and the redirect allow-list that
`/[locale]/auth/callback` returns to. Until they are set, a magic link opens
against localhost.

## Key rotation

All secrets are server-side env vars (never `NEXT_PUBLIC_`): rotate in the
host (Vercel/Supabase), redeploy, then revoke the old key at the provider.
