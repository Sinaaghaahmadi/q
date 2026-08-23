import "server-only";

import { COINS, COIN_CODES, type CoinCode, type CoinQuote, type CoinSnapshot } from "./catalog";

/**
 * Live coin prices, from the same source as the currency board.
 *
 * A separate service rather than a widened `rates/service` because the two
 * differ in the ways that matter: coins have no history endpoint we use, no
 * cross-check against a second provider, and no corridor. What they share is
 * the upstream and the failover shape, so the cache and the staleness rule are
 * copied deliberately rather than abstracted — one shared function with two
 * flags would have been harder to read than sixty lines that say what they do.
 *
 * Prices arrive in Rial and are divided by ten exactly once, here, at
 * ingestion — the same rule the currency provider follows.
 */

const LIVE_ENDPOINT = "https://call1.tgju.org/ajax.json";
const TIMEOUT_MS = 8000;
const REFRESH_SECONDS = Number(process.env.RATE_REFRESH_SECONDS ?? 60);
const DEMO_MODE = process.env.RATES_DEMO_MODE === "true";

/** Beyond this the snapshot is stale even if the fetch succeeded. */
const MAX_AGE_HOURS = 80;

interface TgjuTick {
  p: string;
  h: string;
  l: string;
  dp: number;
  ts: string;
}

let cache: { snapshot: CoinSnapshot; cachedAtMs: number } | null = null;
let lastGood: CoinSnapshot | null = null;
let inFlight: Promise<CoinSnapshot> | null = null;

function toToman(grouped: string): number | null {
  const n = Number(grouped.replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n / 10 : null;
}

/** tgju timestamps are Tehran local time (UTC+03:30, no DST since 2022). */
function tehranIso(ts: string): string {
  return `${ts.replace(" ", "T")}+03:30`;
}

async function fetchLive(): Promise<CoinSnapshot> {
  const response = await fetch(LIVE_ENDPOINT, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { accept: "application/json", "user-agent": "asaex-coins/0.1 (+server)" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`tgju HTTP ${response.status}`);

  const payload = (await response.json()) as { current?: Record<string, TgjuTick> };
  const current = payload.current;
  if (!current || typeof current !== "object") throw new Error("tgju: missing `current` map");

  const quotes: Partial<Record<CoinCode, CoinQuote>> = {};
  let newest = 0;

  for (const code of COIN_CODES) {
    const tick = current[COINS[code].tgjuSymbol];
    if (!tick) continue;
    const mid = toToman(tick.p);
    if (mid === null) continue;

    const observedAt = tehranIso(tick.ts);
    const t = Date.parse(observedAt);
    if (Number.isFinite(t) && t > newest) newest = t;

    quotes[code] = {
      code,
      mid,
      high24h: toToman(tick.h),
      low24h: toToman(tick.l),
      changePct24h: Number.isFinite(tick.dp) ? tick.dp : 0,
      observedAt,
    };
  }

  if (Object.keys(quotes).length === 0) throw new Error("tgju: no coin symbols present");

  const ageHours = newest ? (Date.now() - newest) / 3_600_000 : Infinity;
  return {
    quotes,
    fetchedAt: new Date().toISOString(),
    source: "tgju",
    stale: ageHours > MAX_AGE_HOURS,
  };
}

/**
 * A believable board when the upstream is unreachable.
 *
 * Marked `demo` and `stale` so nothing downstream can present it as a real
 * price: §17.21 is explicit that demo data is always labelled, and a made-up
 * gold price shown without a warning is the single most expensive lie this
 * application could tell.
 */
function demoSnapshot(): CoinSnapshot {
  const base: Record<CoinCode, number> = {
    EMAMI: 219_040_000,
    BAHAR: 216_265_000,
    NIM: 113_000_000,
    ROB: 61_000_000,
    GERAMI: 32_000_000,
    GERAM18: 22_007_500,
    MESGHAL: 95_326_000,
  };
  const now = new Date().toISOString();
  const quotes: Partial<Record<CoinCode, CoinQuote>> = {};
  for (const code of COIN_CODES) {
    const mid = base[code];
    quotes[code] = {
      code,
      mid,
      high24h: Math.round(mid * 1.004),
      low24h: Math.round(mid * 0.996),
      changePct24h: 0,
      observedAt: now,
    };
  }
  return { quotes, fetchedAt: now, source: "demo", stale: true };
}

/**
 * The current board, cached for `RATE_REFRESH_SECONDS`.
 *
 * Failover is the same three steps the currency board uses: live, then the last
 * good snapshot marked stale, then demo marked stale. A single in-flight
 * promise is shared so a burst of requests makes one upstream call.
 */
export async function getCoinSnapshot(): Promise<CoinSnapshot> {
  if (DEMO_MODE) return demoSnapshot();

  const now = Date.now();
  if (cache && now - cache.cachedAtMs < REFRESH_SECONDS * 1000) return cache.snapshot;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const snapshot = await fetchLive();
      cache = { snapshot, cachedAtMs: Date.now() };
      lastGood = snapshot;
      return snapshot;
    } catch {
      if (lastGood) {
        const degraded: CoinSnapshot = { ...lastGood, stale: true };
        cache = { snapshot: degraded, cachedAtMs: Date.now() };
        return degraded;
      }
      const fallback = demoSnapshot();
      cache = { snapshot: fallback, cachedAtMs: Date.now() };
      return fallback;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}
