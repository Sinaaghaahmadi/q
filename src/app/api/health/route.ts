import { NextResponse } from "next/server";
import { getHealth } from "@/lib/rates/service";
import { APP_VERSION, BUILD_SHA } from "@/lib/version";

export const dynamic = "force-dynamic";

export async function GET() {
  const health = await getHealth();
  const ok = health.providers.some((p) => p.ok) || health.snapshot !== null;
  // The version travels with the health check so that "which build is live?"
  // is answerable with curl, from a deploy script or from a support ticket,
  // without opening the app and reading the menu.
  return NextResponse.json(
    { ...health, version: APP_VERSION, build: BUILD_SHA || null },
    { status: ok ? 200 : 503 },
  );
}
