# Qeymat — working notes for Claude

Read this first. It exists so a new session starts oriented instead of
rediscovering the same constraints. Sessions do not share memory; this file is
the memory. Keep it current — if you learn something here that contradicts it,
fix the file in the same PR.

## What is in this repo right now

`q` currently holds one thing: `qeymat-board/`, a self-contained single-file
price board (see its own README).

## The other repositories

The rest of the product lives in four sibling repos, all private. Attach them
with `add_repo` when the task touches them:

| repo | stack |
|---|---|
| `Sinaaghaahmadi/qeymat-api` | Cloudflare Workers + D1 + Drizzle; also a VPS deploy path under `deploy/vps` |
| `Sinaaghaahmadi/qeymat-admin` | Next.js |
| `Sinaaghaahmadi/qeymat-web` | Next.js |
| `Sinaaghaahmadi/qeymat-android` | Gradle / Android |

Each carries its own `CLAUDE.md` and a `handoff/` directory. They were pushed
sanitized — a scan of every commit in all four found no `.env`, keystore,
private key, credentialed connection string, or vendor API key.

## The wider product

Qeymat.online is a Persian price / fintech product. The following is reported by
the owner and **not verified from source** — treat it as orientation, not fact,
and correct it once the code lands:

- Web site + PWA, at `qeymat.online`
- API at `api.qeymat.online`
- Android app, package `ir.a.gheymat`, documented version 1.4.1 (10401)
- An iOS project
- Admin panel at `/admin`
- Customer accounts, tickets, notifications, referral programme
- Planned: investment and payment services

Branding is «قیمت», «قیمت+», and "Qeymat" — use those, not invented variants.

## Environment constraints — read before debugging network failures

**Claude Code sessions cannot reach Iranian hosts.** DNS resolves, but the TLS
connection is reset. Measured on 2026-08-18:

| host | ip | result |
|---|---|---|
| `qeymat.online` | 185.130.50.86 | connection reset |
| `api.qeymat.online` | 185.130.50.86 | connection reset |
| `shetabanhost.com` | 185.130.50.180 | connection reset |
| `digikala.com` | 185.188.104.10 | connection reset |

The block is not specific to this project's server — it covers Iranian hosting
generally. Credentials do not fix it; there is no route. Do not try to work
around it.

What follows from that:

- The live API cannot be called, inspected, or tested from a session. Write
  against a contract the owner supplies (sample request/response), and say
  plainly that the integration is untested rather than implying otherwise.
- The admin panel cannot be viewed. To match its styling, use
  `qeymat-board/tools/extract-theme.js`, which the owner runs in their own
  browser console and pastes back.
- Deployment is the owner's side. A session can produce a build; it cannot ship
  it.
- Screenshots of production have to come from the owner.

## Do not accept credentials

Hosting panel logins, cPanel, FTP, database passwords, API secrets — decline
them. They end up in the transcript, this container is ephemeral, and none of it
grants network access anyway. If a task genuinely needs authenticated access
later, the right shape is a narrowly scoped token against one endpoint, not a
shared account.

## Conventions

- Work on the branch named in the session's instructions; never push to `main`.
- Open pull requests as drafts.
- Verify in a real browser before claiming something works. Chromium is at
  `/opt/pw-browsers/chromium` — launch Playwright with
  `chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })`, since the
  bundled version pin does not match. Do not run `playwright install`.
- Check both pointer modes. Hover-revealed controls are unreachable on touch and
  HTML5 drag never fires there; this has already caused one real defect.
- Check both themes, and check RTL as well as LTR.

## Product bar

The owner cares about visual quality and holds it high. Specifically:

- Mobile-first. A desktop-only interaction is a bug, not a limitation.
- RTL correctness in Persian, including number formatting (Persian digits under
  `fa-IR`) and bidi behaviour around signs and arrows.
- Dark mode must be genuinely readable, not an inverted afterthought.
- Real flows over mocked ones. Where something is simulated — as the board's
  price source currently is — say so prominently rather than letting it read as
  finished.

## The market API contract

Established from `qeymat-api/worker/index.ts` and `worker/market-feed.ts`:

```
GET {base}/v1/market?symbols=fiat-usd,gold-18     header: X-API-Key: qey_live_...
GET {base}/v1/quotes/{id}
GET {base}/v1/history

200 -> { status: "live" | "partial" | "cached", generatedAt, quotes: LiveQuote[],
         directCount, derivedCount }
LiveQuote = { id, price, change, low?, high?, updatedAt?, source,
              derived?, marketMode?, estimated? }
error -> { error: { code, message } }
```

`/api/market`, `/api/history`, `/api/spread` are the internal, unkeyed
equivalents. Keys are `qey_live_` + 24 chars, sent as `X-API-Key` or
`Authorization: Bearer`; the worker sends CORS headers allowing both.

Everything is priced in **toman** except `gold-ounce`, which is USD. Crypto is
toman too — it comes from Nobitex TMN pairs, not Binance USD pairs. Getting this
wrong silently produces prices off by ~90,000x.

`change` is the day change in percent and is supplied by the API; do not derive
one when it is present, or Qeymat surfaces will disagree with each other.

## Design tokens

The admin panel's `app/globals.css` is the source of truth. It declares
`--background --surface --surface-soft --border --text --text-secondary
--text-muted --accent --accent-soft --positive --negative --shadow` on `:root`,
with the dark palette under `:root[data-theme="dark"]`. The identity is green
(`#286c4a` light, `#71c897` dark), the typeface is Vazirmatn, card radius is
13px and control radius 10px.

`qeymat-board` mirrors these one-to-one and asserts equality in
`tools/verify-theme.mjs`. If you change either side, run it.

Known issue, not yet fixed anywhere: `--text-muted` is below AA contrast on the
card surface — 2.66:1 in light, 4.09:1 in dark, where 4.5 is required for
normal text. `#737773` (light) and `#7e847e` (dark) are the smallest changes in
the same hue that pass. This affects the panel itself, not just the board.

## Open questions

- Where does the rest of the codebase live, and which repos should be attached?
  As of 2026-08-18 the only repo reachable from a session is `Sinaaghaahmadi/q`.
- Has anyone made a real call against `/v1/market` in production? The board's
  client is verified against a local mock only.
- `--text-muted` fails WCAG AA on the card surface (2.66:1 light, 4.09:1 dark,
  against 4.5 required). It is the admin panel's own token, so the board
  inherits the problem rather than causing it. See the design-tokens note below.
