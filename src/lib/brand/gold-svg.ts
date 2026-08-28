import { COINS, type CoinCode } from "../coins/catalog";

/**
 * Gold, drawn to the same rig as the currency coins (§2.6).
 *
 * Same 45° camera, same key light at top-left, same soft contact shadow, so a
 * gold coin and a dollar coin sitting on the same board read as one set. What
 * differs is what they are:
 *
 *   · a struck coin is a disc with the Iranian sun-and-lion-free civil motif —
 *     a stylised rosette, which is what the Bahar Azadi actually carries — and
 *     it is drawn at its real relative size, so a quarter coin is visibly a
 *     quarter and nobody has to read the label to see the hierarchy;
 *   · bullion is not a disc at all. A gram of 18-carat is a small bar and a
 *     mesghal is a larger one, and drawing them as coins would be the one
 *     detail on the page that a jeweller would laugh at.
 *
 * A separate generator from `coin-svg.ts` rather than a widened one: that file
 * is keyed to `CURRENCIES` and gains nothing from learning about grams, and
 * threading a second product type through it would have cost more than the
 * forty lines of shared gradient definitions it saves.
 */

const GOLD = {
  faceLight: "#f9e3ac",
  faceMid: "#e0b653",
  faceDark: "#c08e2a",
  edge: "#9c711b",
  deep: "#7a5612",
  shine: "#fff6dc",
} as const;

/** Fine gold is warmer and paler than the 18-carat alloy; the tint says so. */
const BULLION = {
  ...GOLD,
  faceLight: "#fbeec4",
  faceMid: "#e8c66b",
} as const;

export function goldSvg(code: CoinCode, idPrefix: string): string {
  const meta = COINS[code];
  return meta.kind === "bullion" ? barSvg(code, idPrefix) : discSvg(code, idPrefix);
}

function discSvg(code: CoinCode, p: string): string {
  const meta = COINS[code];
  // The disc shrinks with the denomination but the canvas does not, so the
  // coins sit on a common baseline instead of floating at different heights.
  const rx = 24 * meta.scale;
  const ry = 22.4 * meta.scale;
  const cy = 52 - ry;

  return `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${code}">
  <defs>
    <radialGradient id="${p}-face" cx="0.34" cy="0.28" r="0.95">
      <stop offset="0" stop-color="${GOLD.faceLight}"/>
      <stop offset="0.58" stop-color="${GOLD.faceMid}"/>
      <stop offset="1" stop-color="${GOLD.edge}"/>
    </radialGradient>
    <linearGradient id="${p}-edge" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${GOLD.edge}"/>
      <stop offset="1" stop-color="${GOLD.deep}"/>
    </linearGradient>
    <filter id="${p}-blur" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="1.6"/>
    </filter>
  </defs>
  <ellipse cx="32" cy="${(cy + ry + 4).toFixed(1)}" rx="${(rx * 0.73).toFixed(1)}" ry="${(ry * 0.15).toFixed(1)}" fill="#0a0f14" opacity="0.2" filter="url(#${p}-blur)"/>
  <ellipse cx="32" cy="${(cy + 3.2).toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="url(#${p}-edge)"/>
  <ellipse cx="32" cy="${cy.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="url(#${p}-face)"/>
  <ellipse cx="32" cy="${cy.toFixed(1)}" rx="${(rx * 0.8).toFixed(1)}" ry="${(ry * 0.8).toFixed(1)}" fill="none" stroke="${GOLD.faceDark}" stroke-opacity="0.75" stroke-width="1.4"/>
  ${rosette(32, cy, rx * 0.52, ry * 0.52)}
  <ellipse cx="32" cy="${cy.toFixed(1)}" rx="${(rx * 0.8).toFixed(1)}" ry="${(ry * 0.8).toFixed(1)}" fill="none" stroke="${GOLD.shine}" stroke-opacity="0.5" stroke-width="0.8" stroke-dasharray="3 100" stroke-dashoffset="-20"/>
</svg>`;
}

/**
 * The rosette on the coin face.
 *
 * Eight petals on an ellipse, drawn rather than embossed with a glyph: a
 * Persian letter at 20px on a coin face is a smudge, and every one of these
 * products would have carried the same letter anyway.
 */
function rosette(cx: number, cy: number, rx: number, ry: number): string {
  const petals: string[] = [];
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    const px = cx + Math.cos(angle) * rx * 0.62;
    const py = cy + Math.sin(angle) * ry * 0.62;
    petals.push(
      `<ellipse cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" rx="${(rx * 0.3).toFixed(1)}" ry="${(ry * 0.3).toFixed(1)}" fill="${GOLD.shine}" opacity="0.42"/>`,
    );
  }
  return `${petals.join("")}<ellipse cx="${cx}" cy="${cy.toFixed(1)}" rx="${(rx * 0.3).toFixed(1)}" ry="${(ry * 0.3).toFixed(1)}" fill="${GOLD.deep}" opacity="0.32"/>`;
}

/** A small ingot: a gram of 18-carat, or a mesghal. */
function barSvg(code: CoinCode, p: string): string {
  const meta = COINS[code];
  const w = 40 * meta.scale;
  const h = 22 * meta.scale;
  const x = 32 - w / 2;
  const y = 46 - h;
  const bevel = Math.min(6, w * 0.16);

  return `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${code}">
  <defs>
    <linearGradient id="${p}-top" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${BULLION.faceLight}"/>
      <stop offset="1" stop-color="${BULLION.faceMid}"/>
    </linearGradient>
    <linearGradient id="${p}-side" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${BULLION.faceDark}"/>
      <stop offset="1" stop-color="${BULLION.deep}"/>
    </linearGradient>
    <filter id="${p}-blur" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="1.6"/>
    </filter>
  </defs>
  <ellipse cx="32" cy="${(y + h + 6).toFixed(1)}" rx="${(w * 0.52).toFixed(1)}" ry="2.6" fill="#0a0f14" opacity="0.2" filter="url(#${p}-blur)"/>
  <!-- The front face, and a trapezoid on top so the bar has a thickness the
       eye can read at 40px rather than being a flat rectangle. -->
  <path d="M${x.toFixed(1)} ${(y + bevel).toFixed(1)} L${(x + bevel).toFixed(1)} ${y.toFixed(1)} L${(x + w - bevel).toFixed(1)} ${y.toFixed(1)} L${(x + w).toFixed(1)} ${(y + bevel).toFixed(1)} Z" fill="url(#${p}-top)"/>
  <path d="M${x.toFixed(1)} ${(y + bevel).toFixed(1)} L${(x + w).toFixed(1)} ${(y + bevel).toFixed(1)} L${(x + w).toFixed(1)} ${(y + h).toFixed(1)} L${x.toFixed(1)} ${(y + h).toFixed(1)} Z" fill="url(#${p}-side)"/>
  <path d="M${(x + 2).toFixed(1)} ${(y + bevel + 2).toFixed(1)} L${(x + w - 2).toFixed(1)} ${(y + bevel + 2).toFixed(1)}" stroke="${BULLION.shine}" stroke-opacity="0.45" stroke-width="1.2" stroke-linecap="round"/>
  <path d="M${(x + 4).toFixed(1)} ${(y + h - 4).toFixed(1)} L${(x + w * 0.55).toFixed(1)} ${(y + h - 4).toFixed(1)}" stroke="${BULLION.deep}" stroke-opacity="0.5" stroke-width="1.4" stroke-linecap="round"/>
</svg>`;
}
