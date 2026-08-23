"use client";

import { Gauge, TrendingDown, TrendingUp } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { formatNumber, type AppLocale } from "@/lib/money/format";
import { cn } from "@/lib/utils";

/** The band the database enforces (migration 0020). Kept in sync by hand. */
export const BAND_PCT = 7;

/**
 * How far off the market to price, and what that buys you.
 *
 * The two directions are not symmetric in meaning even though the band is:
 * a seller who prices *below* the market is the cheapest offer on the board,
 * and a buyer who prices *above* it is the most attractive. Both get to the
 * front of the queue; they just get there from opposite sides. So the control
 * always frames the move as "sell sooner" or "buy sooner" rather than as a
 * signed percentage the person has to reason about.
 *
 * It refuses to be a percentage-only control. The number that decides anything
 * is the Toman on the line, so the resulting price and the difference against
 * the market are both spelled out underneath — the percentage is the handle,
 * not the answer.
 *
 * The wall at ±7% is the database's, not this component's. If someone types a
 * price past it directly, `p2p_offer_publish` refuses and says by how much.
 */
export function PriceDial({
  direction,
  market,
  rate,
  onRate,
}: {
  direction: "sell" | "buy";
  /** Market mid, or null when no rate is available yet. */
  market: number | null;
  rate: string;
  onRate: (next: string) => void;
}) {
  const t = useTranslations("p2p.dial");
  const locale = useLocale() as AppLocale;

  const rateValue = Number(rate);
  const hasBoth = market !== null && market > 0 && rateValue > 0;
  const driftPct = hasBoth ? ((rateValue - market) / market) * 100 : 0;

  // Which way helps this side trade sooner: a seller wants to be under the
  // market, a buyer wants to be over it.
  const favourable = direction === "sell" ? driftPct < 0 : driftPct > 0;
  const magnitude = Math.abs(driftPct);
  const outsideBand = magnitude > BAND_PCT + 0.001;

  function nudge(pct: number) {
    if (market === null || market <= 0) return;
    const signed = direction === "sell" ? -pct : pct;
    onRate(String(Math.round(market * (1 + signed / 100))));
  }

  if (market === null || market <= 0) return null;

  return (
    <div className="rounded-2xl border border-ink-300/60 bg-canvas/60 p-4">
      <div className="flex items-center gap-2">
        <Gauge className="size-4 text-brand-600" aria-hidden />
        <p className="text-sm font-medium">{t("title")}</p>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-ink-600">
        {t(direction === "sell" ? "bodySell" : "bodyBuy", { pct: BAND_PCT })}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {[0, 1, 3, 5, 7].map((pct) => (
          <button
            key={pct}
            type="button"
            onClick={() => nudge(pct)}
            className={cn(
              "pressable rounded-full border px-3 py-1.5 text-xs font-medium",
              Math.abs(magnitude - pct) < 0.05 && favourable === pct > 0
                ? "border-brand-600 bg-brand-50 text-brand-700 dark:text-brand-600"
                : "border-ink-300 text-ink-600 hover:border-ink-600/40",
            )}
          >
            {pct === 0 ? t("atMarket") : t("off", { pct })}
          </button>
        ))}
      </div>

      {hasBoth ? (
        <dl className="mt-3 space-y-1.5 border-t border-ink-300/50 pt-3 text-xs">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-ink-600">{t("marketNow")}</dt>
            <dd className="num font-medium">
              {formatNumber(market, locale, { maximumFractionDigits: 0 })}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-ink-600">{t("yourPrice")}</dt>
            <dd className="num font-semibold">
              {formatNumber(rateValue, locale, { maximumFractionDigits: 0 })}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-ink-600">{t("difference")}</dt>
            <dd
              className={cn(
                "num inline-flex items-center gap-1 font-medium",
                outsideBand ? "text-down-ink" : favourable ? "text-up-ink" : "text-ink-600",
              )}
            >
              {driftPct < 0 ? (
                <TrendingDown className="size-3.5" aria-hidden />
              ) : (
                <TrendingUp className="size-3.5" aria-hidden />
              )}
              {formatNumber(magnitude, locale, { maximumFractionDigits: 1 })}%{" "}
              {t(driftPct < 0 ? "below" : "above")}
            </dd>
          </div>
        </dl>
      ) : null}

      {outsideBand ? (
        <p className="mt-2 text-xs leading-relaxed text-down-ink">
          {t("outside", { pct: BAND_PCT })}
        </p>
      ) : favourable && magnitude >= 1 ? (
        <p className="mt-2 text-xs leading-relaxed text-up-ink">
          {t(direction === "sell" ? "fasterSell" : "fasterBuy")}
        </p>
      ) : null}
    </div>
  );
}
