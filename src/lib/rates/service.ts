import "server-only";

import { FOREIGN_CODES, type CurrencyCode } from "./catalog";
import { demoProvider, syntheticHistory } from "./providers/demo";
import {
  crossCheckEurUsd,
  frankfurterHealth,
  type CrossCheckResult,
} from "./providers/frankfurter";
import { fetchTgjuHistory, tgjuProvider } from "./providers/tgju";
import type { HistorySeries, ProviderHealth, RateQuote, RatesSnapshot } from "./types";

/**
 * Snapshot service (§7.1). In Phase 3 this becomes a pg_cron Edge Function
 * writing `rate_snapshots` + Supabase Realtime push; for the Phase 0/1 demo it
 * is an in-process cache with the same failover semantics:
 *
 *   tgju → last good snapshot (marked degraded) → seeded demo (marked degraded)
 *
 * Upstream keys and calls never reach the browser — clients only see /api/rates.
 */

const REFRESH_SECONDS = Number(process.env.RATE_REFRESH_SECONDS ?? 60);
const DEMO_MODE = process.env.RATES_DEMO_MODE === "true";
/**
 * Beyond this, a snapshot is degraded even if fetches succeed (source frozen).
 * 80h clears the normal Iranian market gap (Thursday close → Saturday open)
 * so a closed market is not flagged as a pipeline failure; the "updated X ago"
 * ticker still shows the real observation time.
 */
const MAX_OBSERVATION_AGE_HOURS = 80;

interface CacheState {
  snapshot: RatesSnapshot;
  cachedAtMs: number;
}

let cache: CacheState | null = null;
let lastGood: RatesSnapshot | null = null;
let refreshInFlight: Promise<RatesSnapshot> | null = null;

const historyCache = new Map<string, { series: HistorySeries; cachedAtMs: number }>();
const HISTORY_TTL_MS = 60 * 60 * 1000;

function buildSnapshot(quotes: RateQuote[], source: RatesSnapshot["source"]): RatesSnapshot {
  const rates: Record<string, RateQuote> = {};
  let newest = 0;
  for (const q of quotes) {
    rates[q.base] = q;
    const t = Date.parse(q.observedAt);
    if (Number.isFinite(t) && t > newest) newest = t;
  }
  const observedAt = newest ? new Date(newest).toISOString() : new Date().toISOString();
  const ageHours = (Date.now() - newest) / 3_600_000;
  return {
    rates,
    observedAt,
    fetchedAt: new Date().toISOString(),
    source,
    degraded: source !== "tgju" || ageHours > MAX_OBSERVATION_AGE_HOURS,
  };
}

async function refresh(): Promise<RatesSnapshot> {
  if (DEMO_MODE) {
    const quotes = await demoProvider.fetchRates([...FOREIGN_CODES]);
    return buildSnapshot(quotes, "demo");
  }
  try {
    const quotes = await tgjuProvider.fetchRates([...FOREIGN_CODES]);
    const snapshot = buildSnapshot(quotes, "tgju");
    lastGood = snapshot;
    return snapshot;
  } catch {
    if (lastGood) {
      return { ...lastGood, fetchedAt: new Date().toISOString(), degraded: true };
    }
    const quotes = await demoProvider.fetchRates([...FOREIGN_CODES]);
    return buildSnapshot(quotes, "demo");
  }
}

export async function getSnapshot(): Promise<RatesSnapshot> {
  if (cache && Date.now() - cache.cachedAtMs < REFRESH_SECONDS * 1000) {
    return cache.snapshot;
  }
  // Collapse concurrent refreshes into one upstream call.
  refreshInFlight ??= refresh()
    .then((snapshot) => {
      cache = { snapshot, cachedAtMs: Date.now() };
      return snapshot;
    })
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

export async function getHistory(base: CurrencyCode, days: number): Promise<HistorySeries> {
  const key = `${base}:${days}`;
  const cached = historyCache.get(key);
  if (cached && Date.now() - cached.cachedAtMs < HISTORY_TTL_MS) return cached.series;

  let series: HistorySeries;
  if (DEMO_MODE) {
    const snapshot = await getSnapshot();
    const mid = snapshot.rates[base]?.mid ?? 0;
    series = {
      pair: `${base}-IRT`,
      base,
      points: syntheticHistory(base, mid, days),
      source: "synthetic",
    };
  } else {
    try {
      const points = await fetchTgjuHistory(base, days);
      series = { pair: `${base}-IRT`, base, points, source: "tgju" };
    } catch {
      const snapshot = await getSnapshot();
      const mid = snapshot.rates[base]?.mid ?? 0;
      series = {
        pair: `${base}-IRT`,
        base,
        points: syntheticHistory(base, mid, days),
        source: "synthetic",
      };
    }
  }
  historyCache.set(key, { series, cachedAtMs: Date.now() });
  return series;
}

export interface RatesHealth {
  providers: ProviderHealth[];
  crossCheck: CrossCheckResult | null;
  snapshot: { source: string; observedAt: string; degraded: boolean } | null;
}

/** §7.2 guardrail surface: provider health + tgju-vs-ECB cross deviation. */
export async function getHealth(): Promise<RatesHealth> {
  const [tgju, frankfurter, snapshot] = await Promise.all([
    tgjuProvider.health(),
    frankfurterHealth(),
    getSnapshot().catch(() => null),
  ]);

  let crossCheck: CrossCheckResult | null = null;
  const eur = snapshot?.rates["EUR"]?.mid;
  const usd = snapshot?.rates["USD"]?.mid;
  if (eur && usd && snapshot?.source === "tgju") {
    crossCheck = await crossCheckEurUsd(eur, usd).catch(() => null);
  }

  return {
    providers: [tgju, frankfurter],
    crossCheck,
    snapshot: snapshot
      ? { source: snapshot.source, observedAt: snapshot.observedAt, degraded: snapshot.degraded }
      : null,
  };
}
