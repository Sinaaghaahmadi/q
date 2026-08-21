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

## Supabase (from Phase 2)

Migrations in `supabase/migrations` are the §11 schema with RLS, the order
state machine (`assert_transition`), append-only guards, and the balanced-
ledger trigger. Apply with `supabase db reset` on a local stack; pgTAP
skeleton in `supabase/tests/rls.sql` runs via `supabase test db`.
**They have not yet been applied to a hosted project** — do that at the start
of Phase 2 and wire `NEXT_PUBLIC_SUPABASE_*`.

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
