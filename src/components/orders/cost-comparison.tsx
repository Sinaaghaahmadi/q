"use client";

import { Scale } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { Card } from "@/components/ui/card";
import { formatNumber, type AppLocale } from "@/lib/money/format";
import type { Json, Order } from "@/lib/supabase/types";

/**
 * §17.11's comparison, stated rather than implied.
 *
 * tgju publishes a mid; our customer rate is that mid plus our spread, so
 * measured against the mid we save nobody anything. The saving, where there is
 * one, is against what a walk-in counter charges over the same mid — so this
 * shows both numbers and lets the reader subtract, instead of asserting a
 * figure they cannot check (§18: we state numbers plainly, and never hype).
 *
 * It renders nothing at all when the benchmark is missing or when our cost is
 * not actually lower. An honest comparison has to be able to come out badly.
 */
export function CostComparison({
  order,
  benchmark,
}: {
  order: Pick<
    Order,
    | "locked_rate"
    | "benchmark_rate"
    | "send_currency"
    | "send_amount_minor"
    | "platform_fee_minor"
    | "office_fee_minor"
    | "receive_amount_minor"
  >;
  benchmark: Json | null;
}) {
  const t = useTranslations("orders.cost");
  const locale = useLocale() as AppLocale;

  const mid = Number(order.benchmark_rate);
  const ours = Number(order.locked_rate);
  if (!Number.isFinite(mid) || mid <= 0 || !Number.isFinite(ours) || ours <= 0) return null;

  const counterBps = Number(
    (benchmark && typeof benchmark === "object" && !Array.isArray(benchmark)
      ? benchmark.counter_spread_bps
      : null) ?? 200,
  );

  // Everything the customer paid over the public mid: the rate spread plus the
  // explicit fees, as one percentage. Splitting them would understate the cost.
  const tomanLeg =
    order.send_currency === "IRT" ? order.send_amount_minor : order.receive_amount_minor;
  const feeShare =
    tomanLeg > 0 ? (order.platform_fee_minor + order.office_fee_minor) / tomanLeg : 0;
  const rateShare = Math.abs(ours - mid) / mid;
  const ourBps = Math.round((rateShare + feeShare) * 10000);

  if (!Number.isFinite(ourBps) || ourBps >= counterBps) return null;

  return (
    <Card className="space-y-2 p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Scale className="size-4 text-brand-600" aria-hidden />
        {t("title")}
      </h2>
      <p className="text-sm leading-relaxed text-ink-600">
        {t("body", {
          ours: formatNumber(ourBps / 100, locale, { maximumFractionDigits: 2 }),
          counter: formatNumber(counterBps / 100, locale, { maximumFractionDigits: 2 }),
        })}
      </p>
      <p className="text-xs text-ink-600">
        {t("basis", { mid: formatNumber(mid, locale, { maximumFractionDigits: 0 }) })}
      </p>
    </Card>
  );
}
