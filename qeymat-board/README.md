# قیمت — Qeymat

The price board (`qeymat-board/`).

A single-file price watchlist. Open `index.html` in a browser — no build step, no
install, no server. Works offline.

![Qeymat](preview.png)

## What it does

- **Watchlist** of currencies, gold/coin, and crypto. Add and remove assets, and
  reorder them — by dragging with a mouse, or with the ↑ ↓ buttons on each card.
- **Live prices** with a day-change figure (percent and absolute) and a 40-point
  sparkline per asset, coloured by direction.
- **Auto-refresh** every 5 seconds, toggleable, plus a manual refresh.
- **Filter and sort** by group, free-text search, or by top gainers/losers.
- **Persian and English**, with the layout flipping between RTL and LTR and
  numbers formatted for the active locale (Persian digits in FA).
- **Light / dark / follow-system** themes.
- Everything — watchlist, order, prices, history, preferences — persists to
  `localStorage`, so the board comes back exactly as you left it.

Keyboard: <kbd>/</kbd> focuses search, <kbd>R</kbd> refreshes, <kbd>Esc</kbd>
clears the search box.

### Touch

Controls that reveal on hover are unreachable on a touch screen, and HTML5 drag
never fires there. So under `@media (hover: none)` the card controls are always
visible at 40×40 tap targets, reordering moves to explicit ↑ ↓ buttons, and the
footer shows the touch hint instead of the keyboard one. Verified at 390×664
with no horizontal overflow.

## Where the prices come from

The board speaks the real `qeymat-api` contract:

```
GET {base}/v1/market?symbols=fiat-usd,gold-18
header: X-API-Key: qey_live_...

200 -> { status: "live" | "partial" | "cached",
         generatedAt: ISO8601,
         quotes: [{ id, price, change, low?, high?, updatedAt?,
                    source, derived?, marketMode?, estimated? }],
         directCount, derivedCount }
```

Configure it by setting `window.QEYMAT_API` before the script runs, or by
editing the defaults in the `API` object:

```html
<script>window.QEYMAT_API = { base:'https://api.qeymat.online', key:'qey_live_…' }</script>
```

**An API key present means the live feed; absent means the simulation.** That
is the only switch — there is no code edit involved.

The simulation is a mean-reverting random walk, which is what lets the file run
with no network at all. It is never allowed to pass as real: the header carries
a badge reading live / partial / cached / simulated / error, and anything other
than `live` is coloured as a warning.

Day change comes from the API's own `change` field, so the board shows the same
figure as every other Qeymat surface. Only the simulation derives a change from
a session open.

Two things to know when pointing it at production:

- Opening the file directly gives you a `file://` origin, and browsers block
  cross-origin requests from there. Serve the folder instead:
  `npx serve .` or `python -m http.server 8000`.
- The worker already sends `Access-Control-Allow-Headers: X-API-Key,
  Authorization, Content-Type`, so a browser call works once the origin is
  allowed.

**Not verified against production.** The client was tested against a local mock
built from `qeymat-api/worker/index.ts` and `market-feed.ts` — live, partial,
cached, upstream 502, invalid key, unreachable host, and a trailing slash in
`base` all behave correctly. That verifies this client, not the deployment.
Iranian hosts are unreachable from a Claude Code session, so the first real call
has to be made from your browser.

## Symbols

Ids are the API's own, so no translation layer exists to drift:

| group | ids |
|---|---|
| currency | `fiat-usd` `fiat-eur` `fiat-gbp` `fiat-aed` `fiat-try` `fiat-cad` `fiat-chf` `fiat-cny` `fiat-jpy` `fiat-aud` `fiat-kwd` `fiat-sar` |
| gold & coin | `gold-18` `gold-mesghal` `gold-ounce` `coin-emami` `coin-bahar` `coin-half` `coin-quarter` `coin-gram` |
| crypto | `crypto-btc` `crypto-eth` `crypto-usdt` `crypto-bnb` `crypto-sol` `crypto-xrp` `crypto-doge` `crypto-ada` |

Everything is priced in toman except `gold-ounce`, which the API quotes in USD —
crypto included, since those come from Nobitex TMN pairs rather than Binance.

## Theme

The board carries the Qeymat admin panel's own design tokens, read from
`qeymat-admin/app/globals.css`. The mapping is one-to-one:

| admin | board |
|---|---|
| `--background` | `--brand-bg` |
| `--surface` | `--brand-panel` |
| `--surface-soft` | `--brand-panel-2` |
| `--border` | `--brand-line` |
| `--text` / `--text-secondary` / `--text-muted` | `--brand-ink` / `-2` / `-3` |
| `--accent` / `--accent-soft` | `--brand-accent` / `--brand-accent-soft` |
| `--positive` / `--negative` | `--brand-up` / `--brand-down` |
| `--shadow` | `--brand-shadow` |

All 22 values are asserted equal in both themes by `tools/verify-theme.mjs`.
Run it after touching either side, and keep the two in step — the panel is the
source of truth, not this file.

The board also follows the panel's own conventions: `:root[data-theme="dark"]`
for the dark palette, `color-mix()` for derived tints, and Vazirmatn as the
typeface. The panel self-hosts Vazirmatn; this file only names it, so a viewer
without it installed falls back to the system sans stack.

### Matching a different surface

`tools/extract-theme.js` reads design tokens off a live page and prints a
`BRAND` block ready to paste — useful when the source is a page you can open but
whose CSS you cannot read. Paste it into the browser console on that page. It
only reads `getComputedStyle` and stylesheet variables: it sends nothing,
changes nothing, and reads no page content, cookies, or form values.

Run against this board, it recovers all 18 of its own token values exactly.
It is still a heuristic on an unfamiliar page — check `accent` against
`accentRunners` before trusting it. When you can read the stylesheet instead,
do that; it is exact and the script is not.

## Adding an asset

One entry in the `CATALOG` array at the top of the script:

```js
{ id:'fiat-nok', group:'currency', unit:'toman', seed:8200, vol:0.004,
  fa:'کرون نروژ', en:'Norwegian Krone' },
```

The `id` must match an id the API actually serves, or the quote simply never
arrives.

- `unit` — `'toman'` or `'usd'`, controls the suffix and decimal places
- `seed` — starting price, and the anchor the simulation reverts toward
- `vol`  — per-tick volatility for the simulated source only; live data ignores it

It shows up under "Add to watchlist" immediately.

## Layout

```
qeymat-board/
  index.html              the whole app — markup, styles, logic
  tools/verify-theme.mjs  asserts the board's tokens equal the admin panel's
  tools/extract-theme.js  reads design tokens off a live page
  preview.png             screenshot used above
  README.md
```
