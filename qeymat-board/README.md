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

## Matching another surface

All of the board's visual identity lives in one `:root` block at the top of the
stylesheet, marked `BRAND`. Nothing else in the file hardcodes a colour, radius,
or font. The "soft" tints used by chips, focus rings, and the change badges are
mixed from the base colours with `color-mix()`, so changing `--brand-accent`
moves every interactive state with it — there is no second place to edit.

To match a surface you can open in a browser (the Qeymat admin panel, say):

1. Open that page, logged in, on the screen whose look you want.
2. DevTools → Console. If it refuses the paste, type `allow pasting` first.
3. Paste `tools/extract-theme.js` and press Enter.
4. Copy the `:root` block it prints into `index.html`, replacing the BRAND block.
5. Switch that page to its other theme and repeat — each run fills in one half
   (light writes `--brand-*`, dark writes `--brand-*-dk`).

The script only reads `getComputedStyle` and stylesheet variables. It sends
nothing anywhere, modifies nothing, and reads no page content, cookies, or form
values.

If the panel already declares its own custom properties, they are printed under
`customProps` — those are the real design tokens and beat every heuristic in the
script. Use them first and let the sampled values fill the gaps.

**How well it works:** run against this board, it recovers all 18 of the board's
own token values exactly, in both themes. It is still a heuristic on a page it
has never seen — check the `accent` against `accentRunners` before trusting it,
since a page with one large saturated banner can outweigh a small primary button.

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
  tools/extract-theme.js  reads design tokens off a live page
  preview.png             screenshot used above
  README.md
```
