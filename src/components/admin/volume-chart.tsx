import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { PanelSection } from "@/components/layout/panel-section";
import { Link } from "@/i18n/navigation";
import { formatAmount, formatDate, formatNumber, type AppLocale } from "@/lib/money/format";
import { fromMinor } from "@/lib/money/minor";

/** One month of the chart. `start` is that bucket's own first day. */
export type MonthBar = { start: string; volumeMinor: number; settled: number };

export type CorridorSlice = { corridor: string; volumeMinor: number };

const W = 560;
const H = 128;
const PAD_Y = 12;

/**
 * Twelve months of settled Toman volume (§4.3).
 *
 * The last column is the month in progress, so it is drawn faded: a
 * half-finished month rendered like the eleven complete ones next to it reads
 * as a collapse in volume, and that is the one misreading this chart could
 * cause that actually costs somebody a decision.
 */
export function VolumeChart({ months }: { months: MonthBar[] }) {
  const t = useTranslations("admin.dashboard");
  const locale = useLocale() as AppLocale;

  const monthLabel = (start: string) => formatDate(start, locale, { month: "short" });
  const toman = (minor: number) => formatAmount(fromMinor(minor, "IRT"), "IRT", locale);

  const peak = months.reduce(
    (best, month) => (month.volumeMinor > best.volumeMinor ? month : best),
    months[0] ?? { start: new Date().toISOString(), volumeMinor: 0, settled: 0 },
  );
  const max = peak.volumeMinor;
  const first = months[0];
  const last = months[months.length - 1];

  // Twelve bars of zero height are not a chart, and the label that goes with
  // them would read a peak month out to a screen reader that never happened.
  if (max === 0) {
    return (
      <PanelSection
        title={t("volumeTitle")}
        hint={t("sectionHint.volume")}
        href="/admin/finance"
        linkLabel={t("openLedger")}
      >
        <p className="text-sm text-ink-600">{t("noVolume")}</p>
      </PanelSection>
    );
  }

  return (
    <PanelSection
      title={t("volumeTitle")}
      hint={t("sectionHint.volume")}
      href="/admin/finance"
      linkLabel={t("openLedger")}
      bodyClassName="space-y-3"
      footer={t("volumeHint")}
    >
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
              strokeOpacity="0.5"
            />
          ))}
          {months.map((month, index) => {
            const slot = W / months.length;
            const width = slot * 0.52;
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
                /* The month in progress is the faded one, and it is worth
                     saying why because the obvious instinct is the opposite.
                     Emphasis normally highlights "now" — but this bar is not
                     comparable to the eleven beside it: it is three days of
                     trading against eleven finished months. Drawn at full
                     strength it reads as a collapse in volume, every month,
                     on the second of the month. Fading it marks it as
                     provisional, which is what it is.
                     
                     An earlier revision inverted this and made the current
                     month the accent. On a board whose only settled month was
                     Mordad, that de-emphasised the single bar carrying data
                     and highlighted an empty one. */
                fill="var(--brand-600)"
                fillOpacity={index === months.length - 1 ? "0.35" : "0.85"}
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
          className="mt-1.5 grid gap-0.5 text-center"
          style={{ gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))` }}
        >
          {months.map((month) => (
            <p key={month.start} className="text-[0.625rem] font-medium text-ink-600">
              {monthLabel(month.start)}
            </p>
          ))}
        </div>
      </div>
    </PanelSection>
  );
}

/**
 * Where the volume came from. Share of Toman volume, not share of orders: a
 * corridor that carries a tenth of the tickets and half the money is the one
 * that decides whether the quarter works, and counting tickets hides it.
 */
export function CorridorMix({ corridors }: { corridors: CorridorSlice[] }) {
  const t = useTranslations("admin.dashboard");
  const locale = useLocale() as AppLocale;

  const total = corridors.reduce((sum, slice) => sum + slice.volumeMinor, 0);

  return (
    <PanelSection
      title={t("corridorTitle")}
      hint={t("sectionHint.corridors")}
      href="/admin/orders?state=completed"
      linkLabel={t("openSettled")}
      bodyClassName="space-y-2.5"
      footer={total > 0 && corridors.length > 1 ? t("corridorHint") : undefined}
    >
      {total === 0 ? (
        <p className="text-sm text-ink-600">{t("noVolume")}</p>
      ) : corridors.length === 1 && corridors[0] ? (
        /* One corridor is not a mix, and a bar filled to 100% is the
             one-bar bar chart — chart furniture around a fact that fits in a
             sentence. It says the fact instead. */
        <p className="text-sm leading-relaxed">
          {t.rich("corridorOnly", {
            corridor: () => (
              <span className="font-mono font-semibold" dir="ltr">
                {corridors[0]?.corridor}
              </span>
            ),
            amount: () => (
              <span className="num font-semibold">
                {formatAmount(fromMinor(corridors[0]?.volumeMinor ?? 0, "IRT"), "IRT", locale)}
              </span>
            ),
          })}
        </p>
      ) : (
        <>
          {corridors.map((slice) => (
            <Link
              key={slice.corridor}
              href={`/admin/orders?corridor=${encodeURIComponent(slice.corridor)}`}
              className="pressable -mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-ink-300/15"
            >
              <span className="w-24 shrink-0 font-mono text-xs" dir="ltr">
                {slice.corridor}
              </span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-ink-300/40">
                <span
                  className="block h-full rounded-full bg-brand-600"
                  style={{ width: `${Math.max(2, (slice.volumeMinor / total) * 100)}%` }}
                />
              </span>
              <span className="num w-14 shrink-0 text-end text-sm">
                {formatNumber(slice.volumeMinor / total, locale, {
                  style: "percent",
                  maximumFractionDigits: 0,
                })}
              </span>
              <span className="num hidden w-32 shrink-0 text-end text-sm text-ink-600 sm:block">
                {formatAmount(fromMinor(slice.volumeMinor, "IRT"), "IRT", locale)}
              </span>
            </Link>
          ))}
        </>
      )}
    </PanelSection>
  );
}
