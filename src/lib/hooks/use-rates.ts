"use client";

import { useQuery } from "@tanstack/react-query";
import type { CurrencyCode } from "@/lib/rates/catalog";
import type { HistorySeries, RatesSnapshot } from "@/lib/rates/types";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

/**
 * How often a price is allowed to be wrong, and by how much.
 *
 * Two numbers, and they do different jobs. `RATES_REFRESH_MS` is the drumbeat:
 * while a page is open and visible, the snapshot is fetched again every thirty
 * seconds. `RATES_STALE_MS` is the threshold everything else is measured
 * against: past twenty seconds the copy in hand counts as old, so returning to
 * the tab, remounting the component or reconnecting fetches immediately
 * instead of showing the old figure until the next beat.
 *
 * Twenty under thirty is the point. If staleness equalled the interval, a
 * customer coming back to the app a moment before the beat would be handed a
 * price that was about to be replaced, with no way to know it. This way the
 * worst case a price is on screen is thirty seconds, and any deliberate return
 * to the app gets a figure at most twenty seconds old.
 */
export const RATES_REFRESH_MS = 30_000;
export const RATES_STALE_MS = 20_000;

/** Live snapshot — clients poll our API only, never the upstream (§7.1). */
export function useRates() {
  return useQuery<RatesSnapshot>({
    queryKey: ["rates"],
    queryFn: () => fetchJson<RatesSnapshot>("/api/rates"),
    refetchInterval: RATES_REFRESH_MS,
    // A hidden tab stops beating. Polling a phone in a pocket every thirty
    // seconds spends its battery and its data on a screen nobody is looking
    // at, and buys nothing: `refetchOnWindowFocus` with the twenty-second
    // threshold already means the first thing a returning customer sees is a
    // fresh price.
    refetchIntervalInBackground: false,
    staleTime: RATES_STALE_MS,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
  });
}

export interface HistoryPayload {
  series: Record<string, HistorySeries>;
  days: number;
}

export function useRateHistory(bases: CurrencyCode[], days: number) {
  const key = [...bases].sort().join(",");
  return useQuery<HistoryPayload>({
    queryKey: ["rates-history", key, days],
    queryFn: () => fetchJson<HistoryPayload>(`/api/rates/history?bases=${key}&days=${days}`),
    staleTime: 5 * 60_000,
    enabled: bases.length > 0,
  });
}
