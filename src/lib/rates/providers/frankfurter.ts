import "server-only";

import type { ProviderHealth } from "../types";

/**
 * Secondary / cross-check provider (§7.1): frankfurter.dev (ECB reference
 * rates, no key). It cannot price the IRT leg — it is used to (a) verify that
 * tgju-implied crosses (e.g. EUR/USD) track the international market within
 * the §7.2 guardrail, and (b) later derive foreign↔foreign crosses correctly.
 */

const ENDPOINT = "https://api.frankfurter.dev/v1/latest";
const TIMEOUT_MS = 6000;

export interface CrossCheckResult {
  pair: "EUR/USD";
  /** Cross implied by tgju Toman rates. */
  implied: number;
  /** International reference (ECB). */
  reference: number;
  deviationPct: number;
  checkedAt: string;
}

async function fetchLatest(base: string, symbols: string[]): Promise<Record<string, number>> {
  const url = `${ENDPOINT}?base=${base}&symbols=${symbols.join(",")}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`frankfurter HTTP ${res.status}`);
  const json = (await res.json()) as { rates?: Record<string, number> };
  if (!json.rates) throw new Error("frankfurter: missing rates");
  return json.rates;
}

/** Compare the tgju-implied EUR/USD cross against the ECB reference. */
export async function crossCheckEurUsd(
  eurToman: number,
  usdToman: number,
): Promise<CrossCheckResult> {
  const rates = await fetchLatest("EUR", ["USD"]);
  const reference = rates["USD"];
  if (!reference) throw new Error("frankfurter: USD rate missing");
  const implied = eurToman / usdToman;
  const deviationPct = ((implied - reference) / reference) * 100;
  return {
    pair: "EUR/USD",
    implied,
    reference,
    deviationPct,
    checkedAt: new Date().toISOString(),
  };
}

export async function frankfurterHealth(): Promise<ProviderHealth> {
  const started = Date.now();
  try {
    const rates = await fetchLatest("EUR", ["USD"]);
    return {
      id: "frankfurter",
      ok: Boolean(rates["USD"]),
      latencyMs: Date.now() - started,
      error: null,
      checkedAt: new Date().toISOString(),
    };
  } catch (err) {
    return {
      id: "frankfurter",
      ok: false,
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : "unknown error",
      checkedAt: new Date().toISOString(),
    };
  }
}
