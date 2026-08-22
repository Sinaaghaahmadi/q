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
OUT_DIR=/tmp/shots pnpm exec tsx scripts/capture-screens.mts   # elsewhere
```

`BASE_URL` can point at a deployment, but not from inside the agent sandbox:
its egress proxy resets Chromium's connections even where curl succeeds.

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

## Bootstrapping the first account

Nothing works from a cold start: the first person to sign in is an unverified
customer, and KYC approval needs _two_ reviewers. Sign in once at
<https://asaex.vercel.app/signin> — by email, since the SMS gateway is not wired
yet — then, in the Supabase SQL editor:

```sql
-- Give yourself every platform role, so /admin/kyc and the platform
-- transitions open up.
insert into public.memberships (user_id, role, scope_type)
select id, r, 'platform'
from auth.users, unnest(array[
  'platform_support','platform_compliance','platform_admin','platform_superadmin'
]::public.app_role[]) r
where email = 'you@example.com';

-- Approve your own identity so orders can be submitted. This is the one step
-- that deliberately cannot be done through the UI: kyc_decide enforces
-- four-eyes and refuses to let one person do both halves.
update public.profiles set kyc_status = 'approved'
where id = (select id from auth.users where email = 'you@example.com');
```

To exercise the office side as well, create an office and join it:

```sql
insert into public.exchange_offices (slug, legal_name_fa, legal_name_en, license_no, status)
values ('demo', 'صرافی نمونه', 'Demo Exchange', 'DEMO-1', 'active');

insert into public.memberships (user_id, role, scope_type, scope_id)
select u.id, 'office_owner', 'office', e.id
from auth.users u, public.exchange_offices e
where u.email = 'you@example.com' and e.slug = 'demo';
```

One account holding both sides is fine for a walkthrough and wrong for
production — `order_actor_role` resolves platform staff first, so you will act
as the platform on every order rather than as the customer or the office.

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

Re-run the security linter after any schema change, and believe it when it
repeats itself: it kept flagging functions that migration 0007 had "revoked",
and it was right — a `revoke ... from anon, authenticated` never removes the
`PUBLIC` grant Postgres creates with every function, so nothing changed until
0011 revoked from `PUBLIC` (ADR 0015). Assert the effective privilege with
`has_function_privilege`, not the ACL text; `supabase/tests/rls.sql` does.

Any migration that adds a function must revoke it from `PUBLIC` too — new
functions arrive with that grant.

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
Real environment variables override it, which is how any server-only secret
(`KAVENEGAR_API_KEY`, `RESEND_API_KEY`) gets set later.

**Linking the repository requires the Vercel GitHub App**, installed once by the
account owner at <https://github.com/apps/vercel> with access granted to this
repository. It is installed now; without it the Vercel API refuses to create the
project at all:

```
400 bad_request — To link a GitHub repository, you need to install the
GitHub integration first.
```

The app is installed, the project is linked, and the site is live:

|                   |                                                                                  |
| ----------------- | -------------------------------------------------------------------------------- |
| Live (branch)     | <https://asaex-git-claude-happy-bohr-4ibs9c-sinaaghaahmadis-projects.vercel.app> |
| Live (production) | <https://asaex.vercel.app> — tracks the default branch                           |
| Project           | `asaex` (`prj_oT3pmwzeRFdeWni010ObvELPcasU`)                                     |
| Team              | `sinaaghaahmadis-projects` (`team_FtgssC1GVPrfrGWw6rAgmBm2`)                     |
| Repository        | `Sinaaghaahmadi/q`                                                               |

Every push to the linked branch deploys on its own — but as a _preview_. Only
the project's production branch (the repository default) publishes to
`asaex.vercel.app`, so while work sits on a feature branch the production alias
keeps serving whatever was there before, and the branch alias is the one that is
current. `list_deployments` makes it plain: exactly one deployment carries
`target: "production"`.

Two ways to tell them apart without guessing, both of which caught this:

```bash
# The branch alias resolves og:image against its own host; a stale production
# build still resolves it against localhost.
curl -s https://asaex.vercel.app/ | grep -o 'og:image" content="[^"]*"'
```

Merging the pull request is what moves production forward.

One quirk worth writing down: the Vercel API answers reads for this project
only when the scope is given as the **username** (`sinaaghaahmadi`), not as the
team id or team slug — both of those 404 even though the project's `accountId`
is that same team. It is why the project's own creation call reported that it
"could not verify" the git link: the verification read hit the same 404, not a
real linking failure.

`NEXT_PUBLIC_APP_URL` is optional: `appOrigin()` falls back to Vercel's own
`VERCEL_PROJECT_PRODUCTION_URL`, then `VERCEL_URL`, so metadata is absolute
against the right host with no dashboard step. Set it once a custom domain
exists.

The two publishable Supabase values are **inlined at build time** by
`next.config.ts`. Hosts that bundle the server as functions do not carry
`.env.production` into the runtime, so without that the server decides Supabase
is unconfigured while the browser — which has them inlined already — thinks
otherwise, and every auth-gated page renders its "not connected" state instead
of redirecting to sign-in. A real environment variable still wins: Next never
overwrites an entry already present in `process.env`.

Two Supabase settings need the deployed origin as well: **Authentication → URL
Configuration → Site URL**, and the redirect allow-list that
`/[locale]/auth/callback` returns to. Until they are set, a magic link opens
against localhost.

## Key rotation

All secrets are server-side env vars (never `NEXT_PUBLIC_`): rotate in the
host (Vercel/Supabase), redeploy, then revoke the old key at the provider.
