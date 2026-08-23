import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { ChangeChip } from "@/components/rates/change-chip";
import { Card } from "@/components/ui/card";
import { formatAmount, formatDate, formatNumber, type AppLocale } from "@/lib/money/format";
import { fromMinor } from "@/lib/money/minor";

/** A figure and the same figure one month earlier, both in the same unit. */
export type Period = { current: number; previous: number };

/**
 * The five numbers an ops lead opens the console for (§4.3).
 *
 * Three of them carry a month-over-month delta; two of them deliberately do
 * not. "In flight" and "at SLA risk" are counts of how the board stands right
 * now, and the schema keeps no snapshot of how it stood at the end of last
 * month — reconstructing that would mean replaying every order event, and a
 * delta that is nearly right is worse here than no delta at all. Those two get
 * a sentence saying what they mean instead.
 *
 * `atRisk` is null when no open order carries a deadline at all. A zero would
 * be read as an all-clear, and "nothing is late" is a very different statement
 * from "nothing has a date to be late against".
 *
 * The three month-scoped figures carry the span they cover. Read on the first
 * of a month they are all zero, sitting directly above a chart showing a full
 * previous month — which looks like a broken report rather than a young one.
 * Naming the month and how far into it we are costs one line and removes the
 * only reading of this screen that would send somebody looking for a bug.
 */
export function ReportCards({
  volumeMinor,
  settled,
  inFlight,
  atRisk,
  feesMinor,
  month,
}: {
  volumeMinor: Period;
  settled: Period;
  inFlight: number;
  atRisk: { counted: number } | null;
  feesMinor: Period;
  month: { start: string; day: number };
}) {
  const t = useTranslations("admin.dashboard");
  const locale = useLocale() as AppLocale;

  const toman = (minor: number) => formatAmount(fromMinor(minor, "IRT"), "IRT", locale);
  const count = (value: number) => formatNumber(value, locale, { maximumFractionDigits: 0 });

  const monthToDate = t("monthToDate", {
    month: formatDate(month.start, locale, { month: "long" }),
    days: month.day,
  });

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Figure
        label={t("card.volume")}
        value={toman(volumeMinor.current)}
        unit={t("toman")}
        period={volumeMinor}
        locale={locale}
        against={t("vsLastMonth")}
        noBase={t("noBase")}
        hint={monthToDate}
      />
      <Figure
        label={t("card.settled")}
        value={count(settled.current)}
        period={settled}
        locale={locale}
        against={t("vsLastMonth")}
        noBase={t("noBase")}
        hint={monthToDate}
      />
      <Figure
        label={t("card.fees")}
        value={toman(feesMinor.current)}
        unit={t("toman")}
        period={feesMinor}
        locale={locale}
        against={t("vsLastMonth")}
        noBase={t("noBase")}
        hint={monthToDate}
      />
      <Figure label={t("card.inFlight")} value={count(inFlight)} hint={t("hint.inFlight")} />
      {atRisk === null ? (
        <Figure label={t("card.atRisk")} value={t("noData")} hint={t("hint.noDeadlines")} />
      ) : (
        <Figure
          label={t("card.atRisk")}
          value={count(atRisk.counted)}
          hint={t("hint.atRisk")}
          tone={atRisk.counted > 0 ? "warn" : "neutral"}
        />
      )}
    </div>
  );
}

function Figure({
  label,
  value,
  unit,
  hint,
  period,
  locale,
  against,
  noBase,
  tone = "neutral",
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  period?: Period;
  locale?: AppLocale;
  against?: string;
  noBase?: string;
  tone?: "neutral" | "warn";
}) {
  // A month that started from nothing has no percentage to state — dividing by
  // zero would print "∞ percent up", which reads as a triumph rather than as
  // the first month of a corridor.
  const pct =
    period && period.previous > 0
      ? ((period.current - period.previous) / period.previous) * 100
      : null;

  return (
    <Card className="p-5">
      <p className="text-sm text-ink-600">{label}</p>
      <p
        className={`num mt-1.5 text-2xl font-bold tracking-tight ${tone === "warn" ? "text-warn" : ""}`}
      >
        {value}
        {unit ? <span className="ms-1.5 text-sm font-medium text-ink-600">{unit}</span> : null}
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {period && locale ? (
          pct === null ? (
            <span className="text-xs leading-relaxed text-ink-600">{noBase}</span>
          ) : (
            <>
              <ChangeChip pct={pct} locale={locale} />
              <span className="text-xs text-ink-600">{against}</span>
            </>
          )
        ) : null}
        {hint ? <span className="text-xs leading-relaxed text-ink-600">{hint}</span> : null}
      </div>
    </Card>
  );
}
