# Qeymat — working notes for Claude

Read this first. It exists so a new session starts oriented instead of
rediscovering the same constraints. Sessions do not share memory; this file is
the memory. Keep it current — if you learn something here that contradicts it,
fix the file in the same PR.

## What is in this repo right now

`q` currently holds one thing: `qeymat-board/`, a self-contained single-file
price board (see its own README). Everything else described below lives
elsewhere and has not been pushed here yet.

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

## Open questions

- Where does the rest of the codebase live, and which repos should be attached?
  As of 2026-08-18 the only repo reachable from a session is `Sinaaghaahmadi/q`.
- What is the API contract for prices? Needed before the board can go live.
- Does the admin panel declare CSS custom properties? If so those are the real
  design tokens and beat anything sampled.
