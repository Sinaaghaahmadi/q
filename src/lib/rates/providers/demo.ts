import { FOREIGN_CODES, type CurrencyCode } from "../catalog";
import type { HistoryPoint, ProviderHealth, RateProvider, RateQuote } from "../types";

/**
 * Seeded demo provider (§17.21). Serves realistic, deterministic data so every
 * screen can be reviewed offline and CI never depends on the network. Values
 * are anchored to live tgju observations captured on 2026-08-20 (Toman/unit)
 * and drift with a seeded daily walk. Anything served from here is flagged
 * `source: "demo"` and the snapshot is marked degraded — demo data must never
 * masquerade as a live rate (§0.9, §7.1).
 */

const ANCHOR_TOMAN: Record<Exclude<CurrencyCode, "IRT">, number> = {
  USD: 189_400,
  EUR: 221_210,
  GBP: 257_940,
  AED: 51_598,
  TRY: 3_960,
  IQD: 133.3,
  AZN: 110_250,
  AMD: 560,
  GEL: 71_970,
  RUB: 2_292,
  AFN: 2_802,
  PKR: 678.8,
  TMT: 51_900,
  OMR: 492_800,
  KWD: 614_460,
  QAR: 50_660,
  SAR: 50_643,
  CAD: 137_580,
  CNY: 28_270,
};

/** Deterministic PRNG so SSR and CSR agree and demos are reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function daysSinceAnchor(now: Date): number {
  const anchor = Date.UTC(2026, 7, 20);
  return Math.max(0, Math.floor((now.getTime() - anchor) / 86_400_000));
}

/** Daily multiplicative drift for a currency, deterministic per (code, day). */
function driftedMid(code: string, base: number, dayIndex: number): number {
  let value = base;
  const rand = mulberry32(hashSeed(`${code}:walk`));
  for (let i = 0; i <= dayIndex; i++) {
    const step = (rand() - 0.485) * 0.012; // gentle upward-biased walk, ±0.6%/day
    value *= 1 + step;
  }
  return value;
}

export function demoQuoteFor(code: Exclude<CurrencyCode, "IRT">, now = new Date()): RateQuote {
  const day = daysSinceAnchor(now);
  const mid = driftedMid(code, ANCHOR_TOMAN[code], day);
  const prev = day === 0 ? ANCHOR_TOMAN[code] : driftedMid(code, ANCHOR_TOMAN[code], day - 1);
  const changePct24h = ((mid - prev) / prev) * 100;
  const spread = mid * 0.006;
  return {
    pair: `${code}-IRT`,
    base: code,
    mid,
    high24h: mid + spread,
    low24h: mid - spread,
    changePct24h,
    observedAt: now.toISOString(),
    source: "demo",
  };
}

export const demoProvider: RateProvider = {
  id: "demo",
  async fetchRates(codes: CurrencyCode[]): Promise<RateQuote[]> {
    const now = new Date();
    return codes
      .filter((c): c is Exclude<CurrencyCode, "IRT"> => c !== "IRT")
      .map((code) => demoQuoteFor(code, now));
  },
  async health(): Promise<ProviderHealth> {
    return {
      id: "demo",
      ok: true,
      latencyMs: 0,
      error: null,
      checkedAt: new Date().toISOString(),
    };
  },
};

/** Deterministic synthetic daily history ending at the given mid. */
export function syntheticHistory(
  code: CurrencyCode,
  endMid: number,
  days: number,
  now = new Date(),
): HistoryPoint[] {
  const rand = mulberry32(hashSeed(`${code}:history`));
  const points: HistoryPoint[] = [];
  let value = endMid;
  const values: number[] = [];
  for (let i = 0; i < days; i++) {
    values.push(value);
    const step = (rand() - 0.5) * 0.014;
    value /= 1 + step;
  }
  values.reverse();
  for (let i = 0; i < days; i++) {
    const d = new Date(now.getTime() - (days - 1 - i) * 86_400_000);
    const iso = d.toISOString().slice(0, 10);
    const v = values[i];
    if (v !== undefined) points.push({ t: iso, c: v });
  }
  return points;
}

export const DEMO_CODES = FOREIGN_CODES;
