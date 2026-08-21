# Asaex — صرافی آسا

**ارز، به سادگی آسا / Currency, made effortless.**

A currency-exchange & remittance marketplace between licensed exchange
offices: customer PWA + exchange-office panel + super-admin panel, one
codebase, one design system, bilingual (fa-IR RTL / en LTR) from line one.

> **Status: Phases 0–2 delivered.**
> Live tgju.org rates, inline converter, full rate board with history, and a
> transfer quote with rate-lock preview (Phase 1); one-time-code sign-in, the
> KYC wizard, destination-account management, the profile surface and the
> four-eyes admin review queue, all on a live Supabase project in the EU with
> RLS enforced (Phase 2). Roadmap: §20 of the master prompt; decisions in
> `docs/decisions/`.

## Quick start (under ten minutes)

```bash
corepack enable            # pnpm 10
pnpm install
pnpm dev                   # http://localhost:3000 — live tgju data
```

`.env.production` carries the publishable Supabase configuration, so a clone
builds and runs against the live project with no setup. `cp .env.example
.env.local` to point somewhere else or to add gateway credentials. Useful modes:

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
| `/signin`       | One-time-code sign-in by mobile or email, rate-limited server-side                   |
| `/verify`       | Four-step KYC wizard: details → document → live photo → review                       |
| `/accounts`     | Destination accounts with live Sheba / card / IBAN / SWIFT validation                |
| `/profile`      | Verification status, security, referral code, sign-in history                        |
| `/admin/kyc`    | Compliance review queue with signed-URL document viewer and four-eyes approval       |
| `/legal/*`      | Terms · Privacy · AML · Fees · SLA · Complaints — bilingual drafts                   |
| `/en/…`         | Everything above in English/LTR                                                      |

## Checks

```bash
pnpm lint && pnpm typecheck && pnpm test   # eslint · tsc strict · vitest (validators, money, pricing, jalali, phone)
pnpm test:e2e                              # Playwright smoke: fa/en, RTL, /_design, quote, API
pnpm exec tsx scripts/capture-screens.mts  # review screenshots → artifacts/screens
```

CI (`.github/workflows/ci.yml`) runs all of it on every PR, building in demo
mode so it never depends on upstream sources.

## Stack

Next.js 15 (App Router/RSC) · TypeScript strict · Tailwind v4 · Radix ·
Framer Motion · TanStack Query · Zod · next-intl · Serwist PWA · Supabase
(Postgres + RLS + Auth + Storage, migrations in `supabase/migrations`, all
applied to the live EU project) · Vitest · Playwright.

The app holds **no service-role key**: it runs on the publishable key under Row
Level Security, and privileged work goes through `SECURITY DEFINER` functions
that check the caller's role themselves (`docs/decisions/0010`).

## Deploying

`pnpm build` is all a host needs — it restores the webfonts, then runs
`next build`. `.env.production` carries the publishable Supabase URL and key so
a fresh deploy comes up wired to the database; real environment variables
override it. See `docs/runbook.md` for the Vercel specifics, including the one
prerequisite: the Vercel GitHub App has to be installed on the account before a
repository can be linked.

## Docs

- `docs/architecture.md` — order state machine, money-movement ordering, rates pipeline
- `docs/integrations/tgju.md` — verified endpoints, symbols, failure modes
- `docs/brand.md` — the brand system as built (+ `/public/brand`)
- `docs/runbook.md` — operations
- `docs/decisions/` — ADRs
