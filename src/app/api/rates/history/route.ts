import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { CURRENCY_CODES, isCurrencyCode, type CurrencyCode } from "@/lib/rates/catalog";
import { getHistory } from "@/lib/rates/service";
import type { HistorySeries } from "@/lib/rates/types";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  bases: z
    .string()
    .min(1)
    .transform((s) => s.split(",").map((c) => c.trim().toUpperCase()))
    .pipe(z.array(z.enum(CURRENCY_CODES)).min(1).max(20)),
  days: z.coerce.number().int().min(7).max(365).default(30),
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    bases: searchParams.get("bases") ?? "",
    days: searchParams.get("days") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  }

  const bases = parsed.data.bases.filter(
    (b): b is CurrencyCode => isCurrencyCode(b) && b !== "IRT",
  );
  const series: Record<string, HistorySeries> = {};
  await Promise.all(
    bases.map(async (base) => {
      series[base] = await getHistory(base, parsed.data.days);
    }),
  );

  return NextResponse.json(
    { series, days: parsed.data.days },
    { headers: { "cache-control": "public, max-age=300" } },
  );
}
