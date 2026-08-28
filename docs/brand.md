# Asaex brand system — as built (Phase 0)

Reference implementation lives at **`/_design`** (both locales, both themes).
Assets in `/public/brand`, generator in `scripts/generate-brand-assets.mts`.

## Mark

The mark draws the letter **A** from two flow strokes meeting at a rounded
apex, crossed by **two offset lanes** — opposing currency flows passing each
other (the ⇄ of exchange, reduced to its calmest form). It reads as an A at
16 px and as "exchange, in motion" at scale. Construction: 24×24 grid,
3-unit legs, 2.5-unit lanes, rounded caps/joins, optical balance over
mathematical balance.

- Files: `logo-mark.svg`, `logo-mono.svg`, `logo-lockup-en.svg`,
  `logo-lockup-fa.svg` (mark on the **right** in the fa lockup — RTL flex
  order does this naturally, never mirror the mark), `favicon.svg`
  (auto-switches color in dark mode), PNG icon set 192/512/maskable/180,
  `og-image-{fa,en}.png`.
- Clear space: the mark's counter height on all sides. Min size 16 px / 8 mm.
- Never: stretch, rotate, drop-shadow, recolor outside the palette, busy
  backgrounds.
- Launch animation: strokes draw in ~700 ms (`LogoMark animated`), static
  under `prefers-reduced-motion`.

## Color, type, layout

Tokens are defined once in `src/styles/globals.css` (§2.3 values, light +
dark) and mirrored to Tailwind via `@theme inline`. Persian = Vazirmatn
variable (line-height 1.75), English = Inter variable (1.6); both self-hosted
woff2 in `src/fonts` via `next/font/local`. Numbers: Persian digits for fa
display, Latin in inputs/identifiers, `tabular-nums` everywhere
(`src/lib/money/format.ts` is the only formatter). Spacing 4→64 scale, radii
8/12/16/24, exactly three shadow levels.

### Up/down accessibility rule

The palette's up/down greens/reds sit in the deutan confusion band (validated
with a CVD checker), so **color is never the only signal**: every chip and
chart pairs an arrow glyph + explicit sign, and numeric text always wears ink
tokens, never the series color.

## 3D icon system (§2.6)

- **Currency coins:** one generator (`src/lib/brand/coin-svg.ts`) renders all
  20 currencies with a single rig — 45° camera (elliptical face + visible
  thickness), top-left key light, soft contact shadow, brand-neutral metal
  tones (gold/silver/bronze + brand-green for IRT), embossed glyph. Shipped
  as inline SVG in-app (crisp at any size) **plus** exported `.svg` and
  1×/2×/3× `.webp` under `/public/icons/currency` for embeds/sprites.
- **App tiles:** the same rig applied to a rounded square
  (`src/components/brand/app-tile.tsx`, `.app-tile` in `globals.css`) — light
  from above, a hairline along the top edge, a gloss over the upper half, a
  specular ellipse, and a shadow cast in the tile's own colour. It carries a
  lucide glyph in white, and it is what marks a _place_: a row in the
  navigation list, a card heading, a page title, an empty screen.
  - **Seven hues, seven meanings**, not fourteen decorative ones: `brand`
    money, `indigo` authority and security, `sky` people and contact, `teal`
    help and guidance, `amber` caution and time, `slate` paperwork, `rose`
    harm and complaint. An eighth hue means a meaning nobody has named yet.
  - **Three sizes**: `md` (36 px) beside a list row, `lg` (48 px) on a card or
    a page title, `xl` (64 px) alone on an empty screen.
  - **Four shapes of use**: `AppTile` bare, `NavRow` (a list row), `TileHeading`
    (a card heading), `PageHeading` (a page title). `EmptyState` and
    `PanelSection` take one internally.
  - The glyph arrives **already rendered** (`icon={<Wallet />}`): a lucide
    component passed as a prop cannot cross from a server component to a client
    one, and takes the page down with a runtime 500 that neither `tsc` nor
    `next build` catches.
- **Animated scenes (68):** `src/components/brand/scenes/` — one rig
  (`scene.tsx`: brand-tinted disc, contact shadow, 120×120 field, the logo's
  rounded 3-unit stroke) and one kit of recurring objects (`_kit.tsx`: the
  handset, the sheet of paper, the bank card, the counter, the vault, the
  person). SVG + Framer Motion, a few KB each, colour only from tokens, static
  under `prefers-reduced-motion`.
  - **Split by subject, not by screen**, because the same drawing serves both
    sides of the counter: `core` (sign-in and the KYC wizard), `identity` (the
    verdicts), `money` (the order machine), `banking`, `market`, `rewards`,
    `support`, `staff`, `states`.
  - **A scene marks a moment; a tile marks a place or a void.** An order that
    is waiting for a deposit is a moment. A row in a menu is a place. A list
    that will fill up on its own is a void, and keeps its tile.
  - **Import the leaf module, never the barrel.** Every scene module is a
    client module, so one name taken from `@/components/brand/scenes` pulls all
    68 into that route — which put three admin routes over the performance
    budget the first time these were wired. `pnpm budget` is what catches it.
  - `OrderStateScene` maps all 18 order states to a scene, exhaustively, so a
    state added to the machine without a drawing fails the build rather than
    rendering a blank card at somebody whose money is mid-transfer.
- **The boundary:** 3D is for currencies, product concepts, and spot
  illustrations. Functional micro-UI (chevrons, close, search, form
  affordances) stays a 2 px line set (lucide) — 3D at 16 px is noise, not
  polish. A lucide glyph _inside_ a tile is the one crossing: the tile is the
  object, the stroke is only its label.
- Roadmap: true rendered (blender/spline) coin + feature set replaces the
  generated rig at the same filenames when produced; Lottie/Rive narrative
  animations land with the flows that need them (Phase 2+).
