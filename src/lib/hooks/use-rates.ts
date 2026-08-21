"use client";

import { useQuery } from "@tanstack/react-query";
import type { CurrencyCode } from "@/lib/rates/catalog";
import type { HistorySeries, RatesSnapshot } from "@/lib/rates/types";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

/** Live snapshot — clients poll our API only, never the upstream (§7.1). */
export function useRates() {
  return useQuery<RatesSnapshot>({
    queryKey: ["rates"],
    queryFn: () => fetchJson<RatesSnapshot>("/api/rates"),
    refetchInterval: 60_000,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
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
