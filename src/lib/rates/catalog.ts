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
  /** Glyph embossed on the 3D coin face. */
  glyph: string;
  /** Display decimals for amounts of this currency. */
  decimals: number;
  /** tgju symbol for the CURRENCY/IRR price, if quoted there. */
  tgjuSymbol?: string;
  tone: CoinTone;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyMeta> = {
  IRT: { code: "IRT", glyph: "ت", decimals: 0, tone: "brand" },
  USD: { code: "USD", glyph: "$", decimals: 2, tgjuSymbol: "price_dollar_rl", tone: "gold" },
  EUR: { code: "EUR", glyph: "€", decimals: 2, tgjuSymbol: "price_eur", tone: "gold" },
  GBP: { code: "GBP", glyph: "£", decimals: 2, tgjuSymbol: "price_gbp", tone: "gold" },
  AED: { code: "AED", glyph: "د", decimals: 2, tgjuSymbol: "price_aed", tone: "silver" },
  TRY: { code: "TRY", glyph: "₺", decimals: 2, tgjuSymbol: "price_try", tone: "silver" },
  IQD: { code: "IQD", glyph: "ع", decimals: 0, tgjuSymbol: "price_iqd", tone: "bronze" },
  AZN: { code: "AZN", glyph: "₼", decimals: 2, tgjuSymbol: "price_azn", tone: "silver" },
  AMD: { code: "AMD", glyph: "֏", decimals: 0, tgjuSymbol: "price_amd", tone: "bronze" },
  GEL: { code: "GEL", glyph: "₾", decimals: 2, tgjuSymbol: "price_gel", tone: "silver" },
  RUB: { code: "RUB", glyph: "₽", decimals: 2, tgjuSymbol: "price_rub", tone: "bronze" },
  AFN: { code: "AFN", glyph: "؋", decimals: 0, tgjuSymbol: "price_afn", tone: "bronze" },
  PKR: { code: "PKR", glyph: "₨", decimals: 0, tgjuSymbol: "price_pkr", tone: "bronze" },
  TMT: { code: "TMT", glyph: "m", decimals: 2, tgjuSymbol: "price_tmt", tone: "silver" },
  OMR: { code: "OMR", glyph: "ر", decimals: 3, tgjuSymbol: "price_omr", tone: "gold" },
  KWD: { code: "KWD", glyph: "د", decimals: 3, tgjuSymbol: "price_kwd", tone: "gold" },
  QAR: { code: "QAR", glyph: "ر", decimals: 2, tgjuSymbol: "price_qar", tone: "silver" },
  SAR: { code: "SAR", glyph: "ر", decimals: 2, tgjuSymbol: "price_sar", tone: "silver" },
  CAD: { code: "CAD", glyph: "$", decimals: 2, tgjuSymbol: "price_cad", tone: "silver" },
  CNY: { code: "CNY", glyph: "¥", decimals: 2, tgjuSymbol: "price_cny", tone: "bronze" },
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
