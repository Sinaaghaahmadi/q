"use client";

import { ArrowDownRight, ArrowLeft, ArrowUpRight, Minus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { InfoHint } from "@/components/ui/info-hint";
import { Link } from "@/i18n/navigation";
import { formatNumber, type AppLocale } from "@/lib/money/format";
import { cn } from "@/lib/utils";

/**
 * One number a decision hangs on.
 *
 * Follows the stat-tile contract: a label, a value, an optional delta against a
 * named period, and an optional twelve-point trend. What it deliberately does
 * *not* carry is the paragraph the old cards did — every tile on this dashboard
 * had two lines of explanation under it, so five tiles put ten lines of prose
 * where the numbers were supposed to be. The explanation moved behind the `i`,
 * where somebody who wants it can get it and everybody else gets a dashboard.
 *
 * `tone` is the status channel and is reserved for status: `risk` is not
 * "series two", it means somebody needs to act. Direction and goodness are
 * separate — fees rising is good, orders at risk rising is not — so the delta's
 * colour comes from `upIsGood`, not from the sign.
 *
 * The icon arrives as a rendered element, never as a component in a prop. A
 * lucide icon is a function; functions do not cross the server/client boundary,
 * and passing one from the dashboard page 500s it with "Functions cannot be
 * passed directly to Client Components". `PanelNavLink` carries the same note
 * for the same reason — and this component was written ignoring it.
 */
export function MetricTile({
  icon,
  label,
  value,
  unit,
  delta,
  upIsGood = true,
  trend,
  tone = "neutral",
  hint,
  footnote,
  href,
  footnoteHref,
}: {
  /** The icon, already rendered: `<TrendingUp className="size-4" />`. */
  icon: React.ReactNode;
  label: string;
  /** Already formatted — the caller knows whether this is money or a count. */
  value: string;
  unit?: string;
  /** Percentage change against the comparison period, or null when there is none. */
  delta?: number | null;
  upIsGood?: boolean;
  /** Twelve points, oldest first. Drawn only when at least two differ. */
  trend?: number[];
  tone?: "neutral" | "risk" | "good";
  /** Key under the `glossary` namespace. */
  hint?: string;
  /** One short line, when the number needs a caveat rather than a definition. */
  footnote?: string;
  /** The rows this figure was counted from. The tile becomes a link. */
  href?: string;
  /** A second way in, when the footnote names a narrower question than the tile. */
  footnoteHref?: string;
}) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("admin.dashboard");

  const direction =
    delta === null || delta === undefined
      ? null
      : delta > 0.5
        ? "up"
        : delta < -0.5
          ? "down"
          : "flat";
  const good =
    direction === "flat" || direction === null ? null : (direction === "up") === upIsGood;
  const DeltaIcon =
    direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Minus;

  /*
   * The tile is a way in, not a readout.
   *
   * "Four hundred million Toman settled this month" is the beginning of a
   * question, and until now the console answered it with a full stop. The
   * whole tile is the link — a small chevron in the corner would be the
   * correct-looking choice and the wrong one, because the thing the eye lands
   * on is the number, and that is what should be clickable.
   *
   * The `i` and the footnote link are siblings of the anchor rather than
   * children of it. A button inside an anchor is invalid HTML and browsers
   * resolve it by making one of the two unreachable; the definition and the
   * narrower query both stay clickable because they sit outside.
   */
  return (
    <div
      className={cn(
        "glass relative flex flex-col gap-3 rounded-2xl p-4",
        href && "glass-lift pressable",
        tone === "risk"
          ? "[--glass-tint:var(--warn)]"
          : tone === "good"
            ? "[--glass-tint:var(--up)]"
            : "[--glass-tint:transparent]",
      )}
    >
      {/* Stretched over the whole tile, under the two controls that must stay
          reachable. `z-0` on the link and `relative z-1` on those keeps the
          stacking honest without a wrapper element around each. */}
      {href ? (
        <Link href={href} className="absolute inset-0 z-0 rounded-2xl" aria-label={label} />
      ) : null}

      <div className="pointer-events-none flex items-start gap-2.5">
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg",
            tone === "risk"
              ? "bg-warn/15 text-warn-ink"
              : tone === "good"
                ? "bg-up/15 text-up-ink"
                : "bg-brand-50 text-brand-700 dark:text-brand-600",
          )}
        >
          {icon}
        </span>
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 pt-1.5">
          <span className="text-xs font-medium text-ink-600">{label}</span>
          {hint ? <InfoHint term={hint} className="pointer-events-auto relative z-10" /> : null}
        </span>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        {/* Proportional figures, not tabular: at this size `tabular-nums` gives
            every digit the width of a zero and a short number reads loose. */}
        <span className="num text-2xl leading-none font-bold">{value}</span>
        {unit ? <span className="text-xs font-medium text-ink-600">{unit}</span> : null}
        {direction ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold",
              good === null
                ? "bg-ink-300/30 text-ink-600"
                : good
                  ? "bg-up/12 text-up-ink"
                  : "bg-down/12 text-down-ink",
            )}
          >
            <DeltaIcon className="size-3 rtl:-scale-x-100" aria-hidden />
            <span className="num">
              {formatNumber(Math.abs(delta ?? 0), locale, { maximumFractionDigits: 0 })}٪
            </span>
          </span>
        ) : null}
      </div>

      {trend && trend.length > 1 && new Set(trend).size > 1 ? <Trend points={trend} /> : null}

      {/* One line under the number, whichever applies. The caller used to be
          able to pass two strings that said the same thing and get whichever
          the branch order happened to pick. */}
      {footnote ? (
        footnoteHref ? (
          <Link
            href={footnoteHref}
            className="relative z-10 inline-flex items-center gap-1 self-start text-[0.6875rem] leading-tight font-medium text-warn-ink underline-offset-2 hover:underline"
          >
            {footnote}
            <ArrowLeft className="size-3 shrink-0 ltr:rotate-180" aria-hidden />
          </Link>
        ) : (
          <p className="text-[0.6875rem] leading-tight text-ink-600">{footnote}</p>
        )
      ) : delta === null ? (
        <p className="text-[0.6875rem] leading-tight text-ink-600">{t("noComparison")}</p>
      ) : null}
    </div>
  );
}

/**
 * The twelve-point trend behind a tile.
 *
 * The final point is the accent; the rest recede. That is the emphasis form —
 * the reader's question is "where are we now, against where we have been", and
 * colouring all twelve the same makes them a shape rather than an answer.
 */
function Trend({ points }: { points: number[] }) {
  const width = 100;
  const height = 22;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;
  const step = points.length > 1 ? width / (points.length - 1) : width;
  const y = (value: number) => height - 2 - ((value - min) / span) * (height - 4);

  const path = points.map((value, i) => `${i === 0 ? "M" : "L"} ${i * step} ${y(value)}`).join(" ");
  const last = points[points.length - 1] ?? 0;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-5 w-full overflow-visible"
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        d={path}
        fill="none"
        stroke="var(--ink-300)"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={width} cy={y(last)} r="3" fill="var(--brand-600)" />
    </svg>
  );
}
