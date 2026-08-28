# Asaex — صرافی آسا

**ارز، به سادگی آسا / Currency, made effortless.**

A currency-exchange & remittance marketplace between licensed exchange
offices: customer PWA + exchange-office panel + super-admin panel, one
codebase, one design system, bilingual (fa-IR RTL / en LTR) from line one.

> **Status: Phases 0–7 delivered.**
> Live tgju.org rates, inline converter, full rate board with history, and a
> transfer quote with rate-lock preview (Phase 1); one-time-code sign-in, the
> KYC wizard, destination-account management, the profile surface and the
> four-eyes admin review queue (Phase 2); the order state machine end to end —
> submission, the office inbox, both settlement legs and the double-entry
> ledger (Phase 3); and the super-admin panel — office provisioning, per-office
> overrides, time-boxed impersonation, reason-required force transitions,
> compensating refunds and the immutable audit trail (Phase 4). All on a live
> Supabase project in the EU with RLS enforced. Remaining: chat (Phase 5), P2P
> (Phase 6), polish (Phase 7). Roadmap: §20 of the master prompt; decisions in
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

**Live:** <https://asaex-git-claude-happy-bohr-4ibs9c-sinaaghaahmadis-projects.vercel.app>
— the current branch. <https://asaex.vercel.app> is the production alias and
tracks the default branch, so it only catches up when this PR merges.

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

Two targets, and they are not alternatives — the second replaces the first.

**A managed host** (what the preview runs on). `pnpm build` is all it needs; it
restores the webfonts, then runs `next build`. `.env.production` carries the
publishable Supabase URL and key so a fresh deploy comes up wired to the
database. `docs/runbook.md` has the Vercel specifics.

**One machine, everything on it** — `deploy/`. Nine containers: the app,
Postgres, and the four Supabase services the browser talks to, behind Caddy.
Self-hosted rather than managed because eighty components in this app call
Supabase straight from the browser, and a customer in Iran cannot reach Paris
to sign in. Start with `deploy/scripts/preflight.sh` on the target machine; it
changes nothing and reports what that machine can actually do.

    deploy/scripts/preflight.sh     what this server can reach — run first
    deploy/scripts/bootstrap.sh     packages, docker, secrets, hardening, timers
    deploy/scripts/deploy.sh        build, migrate in order, start, verify, roll back
    deploy/scripts/backup.sh        encrypted, verified, pruned with a floor
    deploy/scripts/restore.sh       --list, --drill, or the real thing
    deploy/scripts/harden.sh        firewall, ssh, fail2ban, kernel, swap

`docs/deploy-architecture.md` is what runs where and why;
`docs/deploy-runbook-fa.md` is the same thing in Persian, written for an owner
with no technical background.

## Docs

- `docs/architecture.md` — order state machine, money-movement ordering, rates pipeline
- `docs/integrations/tgju.md` — verified endpoints, symbols, failure modes
- `docs/brand.md` — the brand system as built (+ `/public/brand`)
- `docs/runbook.md` — operations
- `docs/deploy-architecture.md` — the self-hosted stack: what runs where, and the trust boundaries
- `docs/deploy-runbook-fa.md` — راه‌اندازی روی سرور، گام به گام
- `docs/launch-checklist.md` — what must be true before real money
- `docs/decisions/` — ADRs
