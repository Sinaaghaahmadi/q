/**
 * The Asaex mark (§2.2): a letter "A" built from two currency-flow strokes
 * that cross at the apex — one running up-right (tipped with an arrowhead),
 * one coming down-left — with the crossbar drawn as a double-headed exchange
 * arrow. 24×24 grid, 3-unit stroke, rounded joins, optical balance over
 * mathematical balance.
 */
export const LOGO_VIEWBOX = "0 0 24 24";

export const LOGO_STROKES: { d: string; width: number }[] = [
  // the two flow strokes meeting at a rounded apex — the "A"
  { d: "M4.6 20 L11.05 5.15 a1.35 1.35 0 0 1 1.9 0 L19.4 20", width: 3 },
  // two offset crossbar lanes — opposing currency flows passing (⇄, minimal):
  // the upper lane anchors to the left leg, the lower to the right leg
  { d: "M7.9 13.7 H13.6", width: 2.5 },
  { d: "M10.4 16 H17.1", width: 2.5 },
];

/** Static SVG markup — used by the asset generator and OG templates. */
export function logoMarkSvg(color = "currentColor"): string {
  const paths = LOGO_STROKES.map(
    (s) =>
      `<path d="${s.d}" stroke="${color}" stroke-width="${s.width}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
  ).join("\n  ");
  return `<svg viewBox="${LOGO_VIEWBOX}" xmlns="http://www.w3.org/2000/svg" fill="none">\n  ${paths}\n</svg>`;
}
