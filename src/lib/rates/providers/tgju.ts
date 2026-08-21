import "server-only";

import { CURRENCIES, type CurrencyCode } from "../catalog";
import type { HistoryPoint, ProviderHealth, RateProvider, RateQuote } from "../types";

/**
 * Primary provider: tgju.org (§7.1).
 *
 * Verified endpoints (see docs/integrations/tgju.md for full findings):
 *  - Live:    GET https://call1.tgju.org/ajax.json           → { current: { [symbol]: {p,h,l,d,dp,dt,ts} } }
 *  - History: GET https://api.tgju.org/v1/market/indicator/summary-table-data/{symbol}?start=0&length=N
 *             → { data: [[open, low, high, close, Δhtml, Δ%html, "YYYY/MM/DD", jalali], …] } newest-first
 *
 * Prices are Rial; ÷10 to Toman happens here, exactly once, at ingestion.
 * The optional commercial API key (TGJU_API_KEY) is reserved for the paid
 * api.tgju.org tier and is used server-side only (§15).
 */

const LIVE_ENDPOINT = "https://call1.tgju.org/ajax.json";
const HISTORY_ENDPOINT = "https://api.tgju.org/v1/market/indicator/summary-table-data";
const TIMEOUT_MS = 8000;

interface TgjuTick {
  p: string; // price (Rial, comma-grouped)
  h: string; // 24h high
  l: string; // 24h low
  d: string; // absolute change
  dp: number; // percent change
  dt: "high" | "low" | "";
  ts: string; // "YYYY-MM-DD HH:mm:ss" Tehran time
}

function rialToToman(grouped: string): number | null {
  const n = Number(grouped.replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n / 10 : null;
}

/** tgju timestamps are Tehran local time (UTC+03:30, no DST since 2022). */
function tehranTsToIso(ts: string): string {
  return `${ts.replace(" ", "T")}+03:30`;
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { accept: "application/json", "user-agent": "asaex-rates/0.1 (+server)" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`tgju HTTP ${res.status}`);
  return res.json();
}

export const tgjuProvider: RateProvider = {
  id: "tgju",

  async fetchRates(codes: CurrencyCode[]): Promise<RateQuote[]> {
    const payload = (await fetchJson(LIVE_ENDPOINT)) as { current?: Record<string, TgjuTick> };
    const current = payload.current;
    if (!current || typeof current !== "object") throw new Error("tgju: missing `current` map");

    const quotes: RateQuote[] = [];
    for (const code of codes) {
      const symbol = CURRENCIES[code].tgjuSymbol;
      if (!symbol) continue;
      const tick = current[symbol];
      if (!tick) continue;
      const mid = rialToToman(tick.p);
      if (mid === null) continue;

      const sign = tick.dt === "low" ? -1 : 1;
      quotes.push({
        pair: `${code}-IRT`,
        base: code,
        mid,
        high24h: rialToToman(tick.h),
        low24h: rialToToman(tick.l),
        changePct24h: sign * (Number(tick.dp) || 0),
        observedAt: tehranTsToIso(tick.ts),
        source: "tgju",
      });
    }
    if (quotes.length === 0) throw new Error("tgju: no requested symbols present");
    return quotes;
  },

  async health(): Promise<ProviderHealth> {
    const started = Date.now();
    try {
      const payload = (await fetchJson(LIVE_ENDPOINT)) as { current?: Record<string, TgjuTick> };
      const ok = Boolean(payload.current?.["price_dollar_rl"]?.p);
      return {
        id: "tgju",
        ok,
        latencyMs: Date.now() - started,
        error: ok ? null : "price_dollar_rl missing",
        checkedAt: new Date().toISOString(),
      };
    } catch (err) {
      return {
        id: "tgju",
        ok: false,
        latencyMs: Date.now() - started,
        error: err instanceof Error ? err.message : "unknown error",
        checkedAt: new Date().toISOString(),
      };
    }
  },
};

/** Daily close history, ascending by date. */
export async function fetchTgjuHistory(code: CurrencyCode, days: number): Promise<HistoryPoint[]> {
  const symbol = CURRENCIES[code].tgjuSymbol;
  if (!symbol) throw new Error(`tgju: no symbol for ${code}`);

  const url = `${HISTORY_ENDPOINT}/${symbol}?start=0&length=${Math.min(days, 3650)}`;
  const payload = (await fetchJson(url)) as { data?: unknown[][] };
  if (!Array.isArray(payload.data)) throw new Error("tgju history: missing `data`");

  const points: HistoryPoint[] = [];
  for (const row of payload.data) {
    const close = typeof row[3] === "string" ? rialToToman(row[3]) : null;
    const dateG = typeof row[6] === "string" ? row[6].replace(/\//g, "-") : null;
    if (close !== null && dateG) points.push({ t: dateG, c: close });
  }
  return points.reverse();
}
