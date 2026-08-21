import { NextResponse } from "next/server";
import { getSnapshot } from "@/lib/rates/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await getSnapshot();
  return NextResponse.json(snapshot, {
    headers: {
      // Snapshot cache lives server-side; clients poll every 60s and the SW
      // keeps a NetworkFirst copy for the offline shell (§14).
      "cache-control": "no-store",
    },
  });
}
