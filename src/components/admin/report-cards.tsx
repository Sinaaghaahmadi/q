import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { ChangeChip } from "@/components/rates/change-chip";
import { Card } from "@/components/ui/card";
import { formatAmount, formatNumber, type AppLocale } from "@/lib/money/format";
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
 */
export function ReportCards({
  volumeMinor,
  settled,
  inFlight,
  atRisk,
  feesMinor,
}: {
  volumeMinor: Period;
  settled: Period;
  inFlight: number;
  atRisk: { counted: number } | null;
  feesMinor: Period;
}) {
  const t = useTranslations("admin.dashboard");
  const locale = useLocale() as AppLocale;

  const toman = (minor: number) => formatAmount(fromMinor(minor, "IRT"), "IRT", locale);
  const count = (value: number) => formatNumber(value, locale, { maximumFractionDigits: 0 });

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
      />
      <Figure
        label={t("card.settled")}
        value={count(settled.current)}
        period={settled}
        locale={locale}
        against={t("vsLastMonth")}
        noBase={t("noBase")}
      />
      <Figure
        label={t("card.fees")}
        value={toman(feesMinor.current)}
        unit={t("toman")}
        period={feesMinor}
        locale={locale}
        against={t("vsLastMonth")}
        noBase={t("noBase")}
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
