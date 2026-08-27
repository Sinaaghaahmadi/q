"use client";

import { Scale } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { SavingsScene } from "@/components/brand/scenes/rewards";
import { Card } from "@/components/ui/card";
import { InfoHint } from "@/components/ui/info-hint";
import { formatNumber, type AppLocale } from "@/lib/money/format";
import type { Order } from "@/lib/supabase/types";

/**
 * What this order actually cost, stated rather than compared.
 *
 * This used to measure our cost against an assumed walk-in-counter spread and
 * render only when we came out ahead. Two things were wrong with that. The
 * benchmark was a number nobody could check — it was a constant in a config
 * column — and hiding the panel when the comparison went badly meant the
 * feature could only ever flatter us, which is the definition of a claim rather
 * than a disclosure.
 *
 * So it states the figure instead: what came off the transfer, in Toman and as
 * a percentage of it, against the market rate the quote was struck on. A reader
 * who wants to compare has a percentage and a base rate and can compare against
 * anything they like. It renders whenever the numbers exist, good or bad.
 */
export function CostComparison({
  order,
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
}) {
  const t = useTranslations("orders.cost");
  const locale = useLocale() as AppLocale;

  const mid = Number(order.benchmark_rate);
  const ours = Number(order.locked_rate);
  if (!Number.isFinite(mid) || mid <= 0 || !Number.isFinite(ours) || ours <= 0) return null;

  // The Toman side of the transfer, whichever direction it ran in, and
  // everything taken off it: the fee lines plus whatever the rate itself took
  // away from the market mid. Reporting only the fee lines would understate a
  // cost that was partly collected through the rate.
  const tomanLeg =
    order.send_currency === "IRT" ? order.send_amount_minor : order.receive_amount_minor;
  if (tomanLeg <= 0) return null;

  const fees = order.platform_fee_minor + order.office_fee_minor;
  const rateShare = (Math.abs(ours - mid) / mid) * (tomanLeg - fees);
  const totalToman = (fees + rateShare) / 10; // minor units are Rial; Toman is a tenth
  const pct = ((fees + rateShare) / tomanLeg) * 100;

  return (
    <Card className="flex items-start gap-3.5 p-5">
      <SavingsScene size={76} className="hidden sm:block" />
      <div className="min-w-0 flex-1 space-y-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Scale className="size-4 text-brand-600" aria-hidden />
          {t("title")}
          <InfoHint term="commission" />
        </h2>
        <p className="num text-sm leading-relaxed text-ink-600">
          {t("body", {
            toman: formatNumber(Math.round(totalToman), locale),
            pct: formatNumber(pct, locale, { maximumFractionDigits: 2 }),
          })}
        </p>
        <p className="num text-xs text-ink-600">
          {t("basis", { mid: formatNumber(mid, locale, { maximumFractionDigits: 0 }) })}
        </p>
      </div>
    </Card>
  );
}
