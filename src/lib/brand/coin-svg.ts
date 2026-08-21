import { CURRENCIES, type CoinTone, type CurrencyCode } from "../rates/catalog";

/**
 * The 3D currency-coin rig (§2.6). One coherent set: 45° camera (subtle
 * ellipse + visible thickness), key light at top-left, soft contact shadow,
 * brand-neutral metal tones, embossed glyph. Generated as SVG so it stays
 * crisp at every size; `scripts/generate-brand-assets.ts` exports the same
 * markup to /public/icons/currency as .svg plus 1×/2×/3× .webp sprites.
 */

interface ToneSpec {
  faceLight: string;
  faceDark: string;
  edge: string;
  rim: string;
  glyphLight: string;
  glyphDark: string;
}

const TONES: Record<CoinTone, ToneSpec> = {
  gold: {
    faceLight: "#f7dfa2",
    faceDark: "#d8a63e",
    edge: "#a97a1e",
    rim: "#c08e2a",
    glyphLight: "#fff3d0",
    glyphDark: "#8c6414",
  },
  silver: {
    faceLight: "#f2f6f9",
    faceDark: "#bfc9d3",
    edge: "#8593a1",
    rim: "#9aa7b3",
    glyphLight: "#ffffff",
    glyphDark: "#66737f",
  },
  bronze: {
    faceLight: "#eec49c",
    faceDark: "#c2874f",
    edge: "#84542a",
    rim: "#9a6633",
    glyphLight: "#fbe3c6",
    glyphDark: "#6e4218",
  },
  brand: {
    faceLight: "#8fdcbd",
    faceDark: "#16a377",
    edge: "#0b5e44",
    rim: "#0e8a61",
    glyphLight: "#eafaf3",
    glyphDark: "#06442f",
  },
};

/** Glyphs longer than one char get a smaller face size. */
function glyphFontSize(glyph: string): number {
  return glyph.length > 1 ? 17 : 23;
}

export function coinSvg(code: CurrencyCode, idPrefix: string): string {
  const meta = CURRENCIES[code];
  const tone = TONES[meta.tone];
  const p = idPrefix;
  const fs = glyphFontSize(meta.glyph);

  return `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${code}">
  <defs>
    <radialGradient id="${p}-face" cx="0.34" cy="0.28" r="0.95">
      <stop offset="0" stop-color="${tone.faceLight}"/>
      <stop offset="0.62" stop-color="${tone.faceDark}"/>
      <stop offset="1" stop-color="${tone.edge}"/>
    </radialGradient>
    <linearGradient id="${p}-edge" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${tone.edge}"/>
      <stop offset="1" stop-color="${tone.glyphDark}"/>
    </linearGradient>
    <filter id="${p}-blur" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="1.6"/>
    </filter>
  </defs>
  <ellipse cx="32" cy="57.2" rx="17.5" ry="3.4" fill="#0a0f14" opacity="0.20" filter="url(#${p}-blur)"/>
  <ellipse cx="32" cy="33.6" rx="24" ry="22.4" fill="url(#${p}-edge)"/>
  <ellipse cx="32" cy="30.4" rx="24" ry="22.4" fill="url(#${p}-face)"/>
  <ellipse cx="32" cy="30.4" rx="19.2" ry="17.9" fill="none" stroke="${tone.rim}" stroke-opacity="0.8" stroke-width="1.5"/>
  <ellipse cx="32" cy="30.4" rx="19.2" ry="17.9" fill="none" stroke="${tone.faceLight}" stroke-opacity="0.55" stroke-width="0.8" stroke-dasharray="3 100" stroke-dashoffset="-22"/>
  <text x="32.9" y="31.3" text-anchor="middle" dominant-baseline="central" font-family="Vazirmatn, Inter, system-ui, sans-serif" font-weight="700" font-size="${fs}" fill="${tone.glyphDark}" opacity="0.85">${meta.glyph}</text>
  <text x="31.6" y="30" text-anchor="middle" dominant-baseline="central" font-family="Vazirmatn, Inter, system-ui, sans-serif" font-weight="700" font-size="${fs}" fill="${tone.glyphLight}">${meta.glyph}</text>
  <ellipse cx="22" cy="18" rx="9" ry="5.4" fill="#ffffff" opacity="0.32" filter="url(#${p}-blur)" transform="rotate(-28 22 18)"/>
</svg>`;
}
