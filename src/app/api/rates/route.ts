import { NextResponse } from "next/server";
import { getSnapshot } from "@/lib/rates/service";
import { recordSnapshot } from "@/lib/rates/record";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await getSnapshot();

  // Hand the prices to the database on the way past.
  //
  // Price alerts are evaluated in Postgres against `rate_snapshots`, and until
  // now that table had never held a row — the rates cache lived only in this
  // process. This is the cheapest place to close that: the endpoint already
  // runs on the app's own refresh cadence, so recording costs one insert per
  // currency per minute and needs no scheduler of its own.
  //
  // Deliberately not awaited into the response path. A database that is slow or
  // briefly unreachable must not make the public rates endpoint slow or
  // unreachable with it; the alert evaluator already refuses to fire on stale
  // data, so a gap in the series is safe by construction.
  void recordSnapshot(snapshot);

  return NextResponse.json(snapshot, {
    headers: {
      // The snapshot cache lives server-side; clients poll every 30s (see
      // `RATES_REFRESH_MS`) and the service worker keeps a NetworkFirst copy
      // for the offline shell. No store here, because a cached copy of a price
      // is the one thing this endpoint must never hand back.
      "cache-control": "no-store",
    },
  });
}
