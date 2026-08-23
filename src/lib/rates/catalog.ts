/**
 * Currency catalog (§2.6, §7). Phase 1 corridor rule (§1): one leg is always
 * IRT; the other leg is one of the foreign currencies below.
 *
 * All IRT values across the app are Toman. tgju quotes in Rial (IRR);
 * providers divide by 10 exactly once, at the ingestion boundary.
 */

export const CURRENCY_CODES = [
  "IRT",
  "USD",
  "EUR",
  "GBP",
  "AED",
  "TRY",
  "IQD",
  "AZN",
  "AMD",
  "GEL",
  "RUB",
  "AFN",
  "PKR",
  "TMT",
  "OMR",
  "KWD",
  "QAR",
  "SAR",
  "CAD",
  "CNY",
] as const;

export type CurrencyCode = (typeof CURRENCY_CODES)[number];

/** Coin material for the 3D icon rig — one coherent set, never mixed with flags. */
export type CoinTone = "brand" | "gold" | "silver" | "bronze";

export interface CurrencyMeta {
  code: CurrencyCode;
  /**
   * Glyph embossed on the 3D coin face.
   *
   * Where a currency's own symbol is ambiguous against another we carry on this
   * board, the fuller conventional form is used instead: the Gulf currencies
   * all reduce to «ر» or «د» on their own, and three indistinguishable coins in
   * a row are worse than none. `د.إ`, `د.ك`, `ر.ع`, `ر.ق` and `C$` are the
   * forms those currencies are actually written in.
   */
  glyph: string;
  /** Display decimals for amounts of this currency. */
  decimals: number;
  /** tgju symbol for the CURRENCY/IRR price, if quoted there. */
  tgjuSymbol?: string;
  tone: CoinTone;
  /**
   * A single hue lifted from the issuing country's flag, drawn as a thin arc on
   * the coin's rim.
   *
   * Not a flag — §2.6 keeps the coins one metal set and never mixes flags into
   * them, and a flag at 24px is mush anyway. But an all-metal board of twenty
   * coins is a board where nothing is findable at a glance, and this is enough
   * of a cue to locate a currency by memory without breaking the rig.
   */
  accent: string;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyMeta> = {
  IRT: { code: "IRT", glyph: "ت", decimals: 0, tone: "brand", accent: "#239f40" },
  USD: {
    code: "USD",
    glyph: "$",
    decimals: 2,
    tgjuSymbol: "price_dollar_rl",
    tone: "gold",
    accent: "#3c3b6e",
  },
  EUR: {
    code: "EUR",
    glyph: "€",
    decimals: 2,
    tgjuSymbol: "price_eur",
    tone: "gold",
    accent: "#003399",
  },
  GBP: {
    code: "GBP",
    glyph: "£",
    decimals: 2,
    tgjuSymbol: "price_gbp",
    tone: "gold",
    accent: "#c8102e",
  },
  AED: {
    code: "AED",
    glyph: "د.إ",
    decimals: 2,
    tgjuSymbol: "price_aed",
    tone: "silver",
    accent: "#00732f",
  },
  TRY: {
    code: "TRY",
    glyph: "₺",
    decimals: 2,
    tgjuSymbol: "price_try",
    tone: "silver",
    accent: "#e30a17",
  },
  IQD: {
    code: "IQD",
    glyph: "ع.د",
    decimals: 0,
    tgjuSymbol: "price_iqd",
    tone: "bronze",
    accent: "#007a3d",
  },
  AZN: {
    code: "AZN",
    glyph: "₼",
    decimals: 2,
    tgjuSymbol: "price_azn",
    tone: "silver",
    accent: "#00b5e2",
  },
  AMD: {
    code: "AMD",
    glyph: "֏",
    decimals: 0,
    tgjuSymbol: "price_amd",
    tone: "bronze",
    accent: "#d90012",
  },
  GEL: {
    code: "GEL",
    glyph: "₾",
    decimals: 2,
    tgjuSymbol: "price_gel",
    tone: "silver",
    accent: "#ff0000",
  },
  RUB: {
    code: "RUB",
    glyph: "₽",
    decimals: 2,
    tgjuSymbol: "price_rub",
    tone: "bronze",
    accent: "#0039a6",
  },
  AFN: {
    code: "AFN",
    glyph: "؋",
    decimals: 0,
    tgjuSymbol: "price_afn",
    tone: "bronze",
    accent: "#007a36",
  },
  PKR: {
    code: "PKR",
    glyph: "₨",
    decimals: 0,
    tgjuSymbol: "price_pkr",
    tone: "bronze",
    accent: "#01411c",
  },
  TMT: {
    code: "TMT",
    glyph: "m",
    decimals: 2,
    tgjuSymbol: "price_tmt",
    tone: "silver",
    accent: "#28ae66",
  },
  OMR: {
    code: "OMR",
    glyph: "ر.ع",
    decimals: 3,
    tgjuSymbol: "price_omr",
    tone: "gold",
    accent: "#c8102e",
  },
  KWD: {
    code: "KWD",
    glyph: "د.ك",
    decimals: 3,
    tgjuSymbol: "price_kwd",
    tone: "gold",
    accent: "#007a3d",
  },
  QAR: {
    code: "QAR",
    glyph: "ر.ق",
    decimals: 2,
    tgjuSymbol: "price_qar",
    tone: "silver",
    accent: "#8a1538",
  },
  SAR: {
    code: "SAR",
    glyph: "ر.س",
    decimals: 2,
    tgjuSymbol: "price_sar",
    tone: "silver",
    accent: "#006c35",
  },
  CAD: {
    code: "CAD",
    glyph: "C$",
    decimals: 2,
    tgjuSymbol: "price_cad",
    tone: "silver",
    accent: "#d80621",
  },
  CNY: {
    code: "CNY",
    glyph: "¥",
    decimals: 2,
    tgjuSymbol: "price_cny",
    tone: "bronze",
    accent: "#de2910",
  },
};

export const FOREIGN_CODES = CURRENCY_CODES.filter(
  (c): c is Exclude<CurrencyCode, "IRT"> => c !== "IRT",
);

/** The six corridors on the home rate strip (§7.3), by product priority. */
export const TOP_CORRIDORS: CurrencyCode[] = ["USD", "EUR", "GBP", "AED", "TRY", "IQD"];

export function isCurrencyCode(value: string): value is CurrencyCode {
  return (CURRENCY_CODES as readonly string[]).includes(value);
}

/** Pair id used across API/UI, e.g. "USD-IRT". Phase 1: quote leg is always IRT. */
export function pairId(base: CurrencyCode): string {
  return `${base}-IRT`;
}
