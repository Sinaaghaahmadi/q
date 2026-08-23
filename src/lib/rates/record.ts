import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";
import type { RatesSnapshot } from "./types";

/**
 * How often the same observation is worth storing again.
 *
 * The rates endpoint is polled by every open tab, so without this a busy minute
 * would write the same price a hundred times. One row per minute per currency
 * is plenty for an alert evaluator that refuses anything older than fifteen.
 */
const MIN_INTERVAL_MS = 60_000;

/** The last observation actually written, per pair, in this process. */
const lastWritten = new Map<string, number>();

/**
 * Persist a snapshot so the database can answer questions about it.
 *
 * Price alerts live in Postgres and are evaluated there (migration 0029); this
 * is what gives them something to evaluate against. It runs on the caller's own
 * session, so `rate_snapshot_record` sees a real `auth.uid()` and anonymous
 * traffic cannot poison the series — a signed-out visitor polling `/api/rates`
 * simply records nothing, which is correct: the prices they were served are the
 * same ones a signed-in visitor will record a moment later.
 *
 * Never throws. A failure here must not touch the response — the rates endpoint
 * is the one thing on this site that works when everything else does not.
 */
export async function recordSnapshot(snapshot: RatesSnapshot): Promise<void> {
  try {
    // A degraded snapshot is the last good one replayed, or seeded demo data.
    // Writing either would put a price into the series that the market never
    // printed at that moment, which is exactly what an alert must not fire on.
    if (snapshot.degraded) return;

    const now = Date.now();
    const rows = Object.values(snapshot.rates)
      .filter((quote) => {
        const pair = `${quote.base}-IRT`;
        const previous = lastWritten.get(pair) ?? 0;
        return now - previous >= MIN_INTERVAL_MS;
      })
      .map((quote) => ({
        pair: `${quote.base}-IRT`,
        mid: quote.mid,
        source: snapshot.source,
        observed_at: quote.observedAt,
      }));

    if (rows.length === 0) return;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.rpc("rate_snapshot_record", {
      p_rows: rows as unknown as Json,
    });
    if (error) return;

    for (const row of rows) lastWritten.set(row.pair, now);
  } catch {
    // Recording is best-effort by design. See the docblock.
  }
}
