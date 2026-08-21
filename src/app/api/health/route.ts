import { NextResponse } from "next/server";
import { getHealth } from "@/lib/rates/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const health = await getHealth();
  const ok = health.providers.some((p) => p.ok) || health.snapshot !== null;
  return NextResponse.json(health, { status: ok ? 200 : 503 });
}
