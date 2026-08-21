/** §2.3 color tokens — the reference table rendered on /_design. */
export interface TokenRow {
  token: string;
  cssVar: string;
  light: string;
  dark: string;
  useKey: string;
}

export const COLOR_TOKENS: TokenRow[] = [
  {
    token: "brand-600",
    cssVar: "--brand-600",
    light: "#0B6E4F",
    dark: "#12A272",
    useKey: "brand600",
  },
  {
    token: "brand-700",
    cssVar: "--brand-700",
    light: "#095A41",
    dark: "#0E8A61",
    useKey: "brand700",
  },
  { token: "brand-50", cssVar: "--brand-50", light: "#E8F5F0", dark: "#0C1F19", useKey: "brand50" },
  { token: "ink-900", cssVar: "--ink-900", light: "#0A0F14", dark: "#F2F5F7", useKey: "ink900" },
  { token: "ink-600", cssVar: "--ink-600", light: "#4A5560", dark: "#A7B2BC", useKey: "ink600" },
  { token: "ink-300", cssVar: "--ink-300", light: "#C9D1D8", dark: "#3A444E", useKey: "ink300" },
  { token: "surface", cssVar: "--surface", light: "#FFFFFF", dark: "#0F1418", useKey: "surface" },
  { token: "canvas", cssVar: "--canvas", light: "#F6F8F9", dark: "#0A0E11", useKey: "canvas" },
  { token: "up", cssVar: "--up", light: "#128C5A", dark: "#25B07A", useKey: "up" },
  { token: "down", cssVar: "--down", light: "#C0392B", dark: "#E5675A", useKey: "down" },
  { token: "warn", cssVar: "--warn", light: "#B7791F", dark: "#E0A33E", useKey: "warn" },
  { token: "info", cssVar: "--info", light: "#1D6FA5", dark: "#4BA3DC", useKey: "info" },
];

export const TYPE_SCALE_REM = [0.75, 0.875, 1, 1.125, 1.25, 1.5, 2, 2.5, 3] as const;
export const SPACING_SCALE = [4, 8, 12, 16, 24, 32, 48, 64] as const;
export const RADIUS_SCALE = [8, 12, 16, 24] as const;
