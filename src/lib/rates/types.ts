import type { CurrencyCode } from "./catalog";

export type RateSource = "tgju" | "frankfurter" | "demo";

export interface RateQuote {
  /** Pair id, e.g. "USD-IRT". Phase 1: the quote leg is always IRT. */
  pair: string;
  base: CurrencyCode;
  /** Mid market price in Toman per 1 unit of base. */
  mid: number;
  high24h: number | null;
  low24h: number | null;
  /** Signed percent change vs previous close. */
  changePct24h: number;
  /** When the source observed this price (ISO 8601). */
  observedAt: string;
  source: RateSource;
}

export interface ProviderHealth {
  id: string;
  ok: boolean;
  latencyMs: number | null;
  error: string | null;
  checkedAt: string;
}

/** §7.1 provider abstraction. */
export interface RateProvider {
  id: RateSource;
  fetchRates(codes: CurrencyCode[]): Promise<RateQuote[]>;
  health(): Promise<ProviderHealth>;
}

export interface RatesSnapshot {
  /** Keyed by base currency code. */
  rates: Record<string, RateQuote>;
  /** Newest source observation in the set (ISO). */
  observedAt: string;
  /** When our pipeline fetched successfully (ISO). */
  fetchedAt: string;
  source: RateSource;
  /**
   * True when the primary pipeline is failing (fallback data in use) or the
   * newest observation is unreasonably old. Never silently show a stale
   * number (§7.1) — the UI must surface this.
   */
  degraded: boolean;
}

export interface HistoryPoint {
  /** Trading day, YYYY-MM-DD (Gregorian). */
  t: string;
  /** Close, in Toman per unit. */
  c: number;
}

export interface HistorySeries {
  pair: string;
  base: CurrencyCode;
  points: HistoryPoint[];
  source: RateSource | "synthetic";
}
