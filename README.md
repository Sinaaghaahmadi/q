# Asaex — صرافی آسا

**ارز، به سادگی آسا / Currency, made effortless.**

A currency-exchange & remittance marketplace between licensed exchange
offices: customer PWA + exchange-office panel + super-admin panel, one
codebase, one design system, bilingual (fa-IR RTL / en LTR) from line one.

> **Status: Phase 0 (foundation) + Phase 1 front door delivered.**
> Live tgju.org rates, inline converter, full rate board with history,
> transfer quote with rate-lock preview, the `/_design` system route, PWA
> shell, complete Supabase schema (migrations, unapplied), CI. Roadmap: §20
> of the master prompt; decisions in `docs/decisions/`.

## Quick start (under ten minutes)

```bash
corepack enable            # pnpm 10
pnpm install
pnpm dev                   # http://localhost:3000 — live tgju data
```

No env vars are required for the demo. `cp .env.example .env.local` and fill
in as services come online. Useful modes:

```bash
RATES_DEMO_MODE=true pnpm dev   # deterministic seeded data, fully offline (§17.21)
pnpm seed:demo                  # inspect the seeded dataset
pnpm brand:assets               # regenerate logo suite / 3D coins / OG images
```

## The surfaces

| Route           | What's there today                                                                   |
| --------------- | ------------------------------------------------------------------------------------ |
| `/`             | Live rate strip (top-6 corridors) + inline converter — works logged out              |
| `/rates`        | All 19 pairs vs IRT: search, favorites, sparklines, 30/90/180d history, detail sheet |
| `/transfer/new` | Wise-style itemized quote, 15-min rate-lock countdown, "why this rate?" layers       |
| `/_design`      | The design system: tokens, type, components, validators, 3D coins, charts, motion    |
| `/legal/*`      | Terms · Privacy · AML · Fees · SLA · Complaints — bilingual drafts                   |
| `/en/…`         | Everything above in English/LTR                                                      |

## Checks

```bash
pnpm lint && pnpm typecheck && pnpm test   # eslint · tsc strict · vitest (validators, money, pricing)
pnpm test:e2e                              # Playwright smoke: fa/en, RTL, /_design, quote, API
pnpm exec tsx scripts/capture-screens.mts  # review screenshots → artifacts/screens
```

CI (`.github/workflows/ci.yml`) runs all of it on every PR, building in demo
mode so it never depends on upstream sources.

## Stack

Next.js 15 (App Router/RSC) · TypeScript strict · Tailwind v4 · Radix ·
Framer Motion · TanStack Query · Zod · next-intl · Serwist PWA · Supabase
(schema ready in `supabase/migrations`) · Vitest · Playwright.

## Docs

- `docs/architecture.md` — order state machine, money-movement ordering, rates pipeline
- `docs/integrations/tgju.md` — verified endpoints, symbols, failure modes
- `docs/brand.md` — the brand system as built (+ `/public/brand`)
- `docs/runbook.md` — operations
- `docs/decisions/` — ADRs
