import { NextResponse } from "next/server";
import { APP_VERSION, BUILD_SHA } from "@/lib/version";

export const dynamic = "force-dynamic";

/**
 * Liveness: is this process still serving?
 *
 * Deliberately separate from `/api/health`, and the distinction is not
 * pedantry. `/api/health` asks the upstream rate providers whether they are
 * answering, which takes as long as their timeouts allow — five seconds each
 * when they are down. Pointing a container healthcheck at that means an outage
 * at tgju marks *our* container unhealthy, Docker restarts it, and a
 * third-party's bad afternoon becomes a restart loop on a currency exchange
 * that was serving perfectly well from cache.
 *
 * So: this endpoint touches nothing. It allocates a small object and returns
 * it. If it answers, the process is up and the orchestrator should leave it
 * alone; whether the data behind it is fresh is a question for the operator's
 * dashboard, which is what `/api/health` is.
 */
export function GET() {
  return NextResponse.json(
    { ok: true, version: APP_VERSION, build: BUILD_SHA || null, at: new Date().toISOString() },
    { headers: { "cache-control": "no-store" } },
  );
}
