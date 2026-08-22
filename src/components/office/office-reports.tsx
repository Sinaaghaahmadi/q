"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAmount, formatDate, formatNumber, type AppLocale } from "@/lib/money/format";
import { fromMinor } from "@/lib/money/minor";

/** One bucket of the volume chart. `start` is the first day of that month. */
export type MonthBar = { start: string; orders: number; volumeMinor: number };

export type CorridorSlice = { corridor: string; orders: number };

const W = 560;
const H = 150;
const PAD_Y = 10;

/**
 * How much this office moved, and how well (§4.2).
 *
 * Every figure here is folded from the office's own orders and their events, so
 * it says the same thing the timeline says — there is no separate reporting
 * table to drift away from the ledger. Volume counts completed orders only,
 * because money that never reached a till is not volume, and the caption says
 * so rather than leaving the two numbers to be reconciled by guesswork.
 */
export function OfficeReports({
  months,
  corridors,
  totalOrders,
  totalVolumeMinor,
  completion,
  sla,
}: {
  months: MonthBar[];
  corridors: CorridorSlice[];
  totalOrders: number;
  totalVolumeMinor: number;
  /** null until at least one order has both a first event and a completion. */
  completion: { sampled: number; averageMinutes: number } | null;
  /** null when no order in the period carried a deadline to be judged against. */
  sla: { measured: number; onTime: number } | null;
}) {
  const t = useTranslations("officePanel.reports");
  const locale = useLocale() as AppLocale;

  if (totalOrders === 0) {
    return <Card className="p-10 text-center text-sm text-ink-600">{t("empty")}</Card>;
  }

  const monthLabel = (start: string) => formatDate(start, locale, { month: "short" });
  const toman = (minor: number) => formatAmount(fromMinor(minor, "IRT"), "IRT", locale);

  const peak = months.reduce(
    (best, month) => (month.volumeMinor > best.volumeMinor ? month : best),
    months[0] ?? { start: new Date().toISOString(), orders: 0, volumeMinor: 0 },
  );
  const max = peak.volumeMinor;
  const first = months[0];
  const last = months[months.length - 1];

  const completionText = completion
    ? completion.averageMinutes >= 90
      ? t("hours", {
          value: formatNumber(completion.averageMinutes / 60, locale, {
            maximumFractionDigits: 1,
          }),
        })
      : t("minutes", { value: formatNumber(Math.round(completion.averageMinutes), locale) })
    : t("noData");

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Figure label={t("stat.orders")} value={formatNumber(totalOrders, locale)} />
        <Figure label={t("stat.volume")} value={toman(totalVolumeMinor)} unit={t("toman")} />
        <Figure
          label={t("stat.completion")}
          value={completionText}
          hint={completion ? t("completionHint", { count: completion.sampled }) : t("noCompleted")}
        />
        <Figure
          label={t("stat.sla")}
          value={
            sla
              ? formatNumber(sla.onTime / sla.measured, locale, {
                  style: "percent",
                  maximumFractionDigits: 0,
                })
              : t("noData")
          }
          hint={sla ? t("slaHint", { count: sla.measured }) : t("noSla")}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("volumeTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Time reads left→right in both locales, as it does on the rate chart. */}
          <div dir="ltr">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="h-auto w-full"
              role="img"
              aria-label={t("chartLabel", {
                from: first ? monthLabel(first.start) : "",
                to: last ? monthLabel(last.start) : "",
                peak: monthLabel(peak.start),
                max: toman(max),
              })}
            >
              {[0.25, 0.5, 0.75].map((f) => (
                <line
                  key={f}
                  x1={0}
                  x2={W}
                  y1={PAD_Y + (H - PAD_Y * 2) * f}
                  y2={PAD_Y + (H - PAD_Y * 2) * f}
                  stroke="var(--ink-300)"
                  strokeOpacity="0.35"
                  strokeDasharray="2 5"
                />
              ))}
              {months.map((month, index) => {
                const slot = W / months.length;
                const width = slot * 0.5;
                const full = H - PAD_Y * 2;
                const height = max > 0 ? (full * month.volumeMinor) / max : 0;
                return (
                  <rect
                    key={month.start}
                    x={slot * index + (slot - width) / 2}
                    y={PAD_Y + full - height}
                    width={width}
                    height={height}
                    rx="4"
                    fill="var(--brand-600)"
                    fillOpacity="0.85"
                  />
                );
              })}
              <line
                x1={0}
                x2={W}
                y1={H - PAD_Y}
                y2={H - PAD_Y}
                stroke="var(--ink-300)"
                strokeOpacity="0.7"
              />
            </svg>

            <div
              className="mt-1.5 grid gap-1 text-center"
              style={{ gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))` }}
            >
              {months.map((month) => (
                <div key={month.start} dir={locale === "fa" ? "rtl" : "ltr"}>
                  <p className="text-xs font-medium">{monthLabel(month.start)}</p>
                  <p className="num text-[0.6875rem] text-ink-600">
                    {t("monthOrders", { count: month.orders })}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-ink-600">{t("volumeHint")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("corridorTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {corridors.map((slice) => (
            <div key={slice.corridor} className="flex items-center gap-3">
              <span className="w-24 shrink-0 font-mono text-xs" dir="ltr">
                {slice.corridor}
              </span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-ink-300/40">
                <span
                  className="block h-full rounded-full bg-brand-600"
                  style={{ width: `${Math.max(4, (slice.orders / totalOrders) * 100)}%` }}
                />
              </span>
              <span className="num w-12 shrink-0 text-end text-sm">
                {formatNumber(slice.orders, locale)}
              </span>
            </div>
          ))}
          <p className="text-xs text-ink-600">{t("corridorHint")}</p>
        </CardContent>
      </Card>
    </div>
  );
}

function Figure({
  label,
  value,
  unit,
  hint,
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
}) {
  return (
    <Card className="p-5">
      <p className="text-sm text-ink-600">{label}</p>
      <p className="num mt-1.5 text-2xl font-bold tracking-tight">
        {value}
        {unit ? <span className="ms-1.5 text-sm font-medium text-ink-600">{unit}</span> : null}
      </p>
      {hint ? <p className="mt-1.5 text-xs leading-relaxed text-ink-600">{hint}</p> : null}
    </Card>
  );
}
