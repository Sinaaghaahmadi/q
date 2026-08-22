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

## Signing in to the panels

Staff — platform and exchange-office alike — sign in with **email and password**
on the `کارکنان` / `Staff` tab of `/signin`. Customers never do: they get a
one-time code, because a remittance app has no business asking someone to invent
a password. `/api/auth/password` refuses any account without a `memberships`
row, so the channel cannot become a general customer login by accident.

The demo accounts, all with the password `AsaDemo!1404`:

| Account                 | Opens        | Roles                                                               |
| ----------------------- | ------------ | ------------------------------------------------------------------- |
| `admin@asaex.demo`      | `/admin`     | `platform_admin`, `platform_superadmin`                             |
| `compliance@asaex.demo` | `/admin/kyc` | `platform_compliance`                                               |
| `operator@asaex.demo`   | `/office`    | `office_owner`, `office_operator`, `office_finance` at `asa-tehran` |

**These are demo credentials and must be rotated before production** — they are
in this file, in the repository, and in the seed. `docs/launch-checklist.md`
blocks go-live on rotating them and on adding TOTP (§15).

Supabase's built-in mailer is rate-limited to a couple of messages an hour, so
the email one-time code is not a reliable way in during a demo. That is the
whole reason the password channel exists.

### What is behind each panel

`/office` is the exchange-office panel and it is deliberately not a dashboard.
The landing screen is **کار امروز** — one card per job, one full-width green
button per card carrying a plain sentence ("پول تومانی رسید"), four progress
dots, and a "مشکلی هست؟" link for the paths that are not the happy one. A whole
transfer is four presses; the fifth act belongs to the customer, so between
"sent" and "settled" the panel says who is being waited on instead of offering a
button the machine would refuse. `src/lib/office/steps.ts` is the mapping from
the nineteen-state machine to those four, and `tests/unit/office-steps.test.ts`
asserts every state is classified. The rest of the menu is the depth behind it:

| Route               | What it is                                                 |
| ------------------- | ---------------------------------------------------------- |
| `/office`           | Today's work — the four-button flow                        |
| `/office/requests`  | The matching pool and this office's own orders, filterable |
| `/office/chat`      | Order threads and support threads in one inbox             |
| `/office/accounts`  | The office's settlement accounts, public and internal      |
| `/office/liquidity` | Position per currency, from the ledger                     |
| `/office/rates`     | Per-corridor spread, min/max, cut-off                      |
| `/office/customers` | Who this office has served, with KYC state                 |
| `/office/team`      | Seats at this office, granted and revoked                  |
| `/office/reports`   | Six Jalali months of volume, completion and SLA            |
| `/office/settings`  | Hours, auto-accept, notification preferences               |

`/admin` opens on **گزارش‌های مدیریت** — settled volume, platform fee, orders in
flight, SLA risk, twelve Jalali months of volume, corridor mix, a scorecard per
office, the state breakdown, and the live audit feed. The sidebar groups the
depth into overview / operations / customers and compliance / money / platform:

| Route               | What it is                                                 |
| ------------------- | ---------------------------------------------------------- |
| `/admin/orders`     | Every order, with force-transition                         |
| `/admin/exchanges`  | Provisioning, per-office configuration, act-as             |
| `/admin/p2p`        | Offers, trades, disputes                                   |
| `/admin/support`    | The support queues                                         |
| `/admin/users`      | Every customer; a row opens their history, tier and logins |
| `/admin/kyc`        | The four-eyes review queue                                 |
| `/admin/compliance` | Sanctions hits, flagged messages, tier and P2P thresholds  |
| `/admin/finance`    | Ledger and reconciliation                                  |
| `/admin/rates`      | Provider health, corridor spreads across offices, bounds   |
| `/admin/content`    | FAQ, announcements and notification templates, fa and en   |
| `/admin/settings`   | Feature flags, platform settings, business calendar        |
| `/admin/audit`      | The audit log                                              |

Every one of those routes is asserted to exist by `tests/unit/panel-nav.test.ts`
— a menu item that points at a 404 is a bug the nav itself should catch.

## Bootstrapping the first account

Nothing works from a cold start: the first person to sign in is an unverified
customer with no roles, and KYC approval needs _two_ reviewers. Sign in once at
the deployment's `/signin` — by email, since the SMS gateway is not wired yet —
then run this once in the Supabase SQL editor, with your own address in the two
places it appears.

The seeded demo accounts (`admin@asaex.demo` and the rest) cannot be signed in
to: they have no password and their domain receives no mail. They exist to give
the screens data, not to be logged into. This snippet puts _your_ account in
their place.

```sql
-- 1. Every platform role, so /admin and its sections open up.
insert into public.memberships (user_id, role, scope_type)
select id, r, 'platform'
from auth.users, unnest(array[
  'platform_support','platform_compliance','platform_admin','platform_superadmin'
]::public.app_role[]) r
where email = 'you@example.com'
on conflict do nothing;

-- 2. A seat at the seeded Tehran office, so /office has an inbox too.
insert into public.memberships (user_id, role, scope_type, scope_id)
select u.id, 'office_owner', 'office', e.id
from auth.users u, public.exchange_offices e
where u.email = 'you@example.com' and e.slug = 'asa-tehran'
on conflict do nothing;

-- 3. Approve your own identity so you can submit an order. This is the one
--    step that deliberately cannot be done through the UI: kyc_decide enforces
--    four-eyes and refuses to let one person do both halves.
update public.profiles set kyc_status = 'approved'
where id = (select id from auth.users where email = 'you@example.com');
```

If the demo data is not there yet, run `pnpm seed:demo` first (see **Demo
data** below) or drop step 2.

One account holding both sides is fine for a walkthrough and wrong for
production — `order_actor_role` resolves platform staff before office
membership, so on any order you will act as the platform, whose matrix is
deliberately narrow: it can route, ask for information, dispute and reverse,
but it cannot move a settlement leg. The one exception is an active
impersonation, which answers ahead of everything (0015): while standing in for
an office you act with that office's matrix, on that office's orders, and the
event still records your own user id.

So to walk the office side properly, use `/admin/exchanges/{id}` → **Act as
this office** rather than granting yourself an office seat.

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

## Onboarding an exchange office

`/admin/exchanges` → **Provision an office**: legal details → corridors and
spreads → settlement accounts → activate. It is one transaction
(`admin_create_office`), so a failure leaves nothing half-created, and the
office lands in `draft` — activation is a separate, deliberate act that
refuses to proceed until the office has a public settlement account for
customers to pay into.

Corridors and spreads start from the platform template in
`settings.office_defaults`; the office's own page marks each spread as
**from template** or **overridden**, which is the diff §16.2 asks for.

Add its team afterwards from the same page, or with
`admin_set_office_member(office, user, 'office_operator')`.

## Stuck order

1. Read `order_events` for the order — append-only, ordered by `seq`.
2. Check the SLA state and the office's working hours.
3. `/admin/orders` → **Force**. Pick the target state, write a reason of at
   least eight characters, apply. Never a raw `UPDATE`: the event row is what
   the customer's own timeline reads, and a forced move is flagged there.

Forcing an order to `refunded` posts reversing ledger entries — direction
flipped, amounts and accounts preserved, memos prefixed `reversal:` — rather
than editing anything. Reports over `ledger_entries` must therefore net rather
than sum. A terminal order (completed, cancelled, refunded, expired,
SLA-breached) cannot be forced anywhere: correct it with a new compensating
action instead of rewinding it.

## Acting as an exchange office

`/admin/exchanges/{id}` → write a reason → **Act as this office**. Restricted
to `platform_superadmin`. The session lasts 30 minutes (4 hours maximum),
shows a banner with a live countdown on every admin screen, and expires on its
own; **End session** closes it early. Everything done while impersonating still
records your own user id — the office is the scope, never the identity — and
both the start and the end land in the audit log.

## P2P limits

Ceilings and cooldowns live in `settings.p2p_limits` and are read by
`p2p_limits()`, so raising them is a row edit rather than a deploy:

```sql
update public.settings
   set value = jsonb_set(value, '{tier_max_irt,1}', '2000000000')
 where key = 'p2p_limits';
```

`tier_max_irt` is keyed by `profiles.risk_tier`; the default caps tier 0 at 200
million Toman per trade. Both sides of a trade are checked, so a low-tier taker
cannot be used to move a high-tier maker's money.

An offer with no active office covering its corridor cannot be taken at all —
`p2p_route_escrow` returns nothing and the take is refused with "no active
exchange office covers …". That is the intended failure: there is nobody to
hold the Toman.

## Demo data

```bash
DATABASE_URL="postgres://…" pnpm seed:demo
```

Applies `supabase/seed/demo.sql`: two offices (one live, one draft), a
compliance reviewer, three verified customers with destination accounts, and
five orders spread across the state machine — including one refunded through
the administrator's override, so the compensating entries are visible in the
ledger. It also seeds conversations: a negotiate-then-transact exchange on the
live order with an internal note and one flagged message, plus a thread in each
of the three support queues, and two P2P offers with one taken trade — which
routes a real order to the escrow office, so `/p2p`, `/p2p/[id]` and a trade
workspace all have content. Idempotent; it does nothing if the demo offices
already exist. Every person, licence and account in it is fictional.

The same file is the Phase-4 acceptance run: it provisions through
`admin_create_office` and drives every order through `order_advance`,
`order_claim` and `order_force_transition` as the role that would really press
the button, under `set local role authenticated` so RLS is in force.

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
