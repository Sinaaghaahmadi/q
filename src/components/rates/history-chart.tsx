"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { formatDate, formatRate, type AppLocale } from "@/lib/money/format";
import type { HistoryPoint } from "@/lib/rates/types";
import { cn } from "@/lib/utils";

interface HistoryChartProps {
  points: HistoryPoint[];
  height?: number;
  className?: string;
  /** Currency code, so the chart can describe itself to a screen reader. */
  code?: string;
}

const W = 560;
const PAD_X = 8;
const PAD_Y = 12;

/**
 * Single-series area chart: 2px brand line, recessive grid (3 lines),
 * crosshair + tooltip on hover, min/max in muted ink. Value text always wears
 * ink tokens, never the series color. Time flows left→right in both locales.
 */
export function HistoryChart({ points, height = 220, className, code }: HistoryChartProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("ratesPage");
  const id = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const [hover, setHover] = React.useState<number | null>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);

  if (points.length < 2) {
    return <div className={cn("h-48 rounded-xl bg-ink-300/15", className)} />;
  }

  const values = points.map((p) => p.c);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => PAD_X + ((W - PAD_X * 2) * i) / (points.length - 1);
  const y = (v: number) => PAD_Y + (height - PAD_Y * 2) * (1 - (v - min) / span);

  const coords = points.map((p, i) => `${x(i).toFixed(1)},${y(p.c).toFixed(1)}`);
  const line = `M${coords.join(" L")}`;
  const area = `${line} L${(W - PAD_X).toFixed(1)},${height - PAD_Y} L${PAD_X},${height - PAD_Y} Z`;

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - PAD_X) / (W - PAD_X * 2)) * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, i)));
  }

  const hoverPoint = hover !== null ? points[hover] : undefined;
  const first = points[0];
  const last = points[points.length - 1];

  return (
    <div className={cn("relative", className)} dir="ltr">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${height}`}
        className="h-auto w-full touch-none select-none"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label={t("chartSummary", {
          code: code ?? "",
          days: points.length,
          from: formatRate(first?.c ?? 0, locale),
          to: formatRate(last?.c ?? 0, locale),
        })}
      >
        <defs>
          <linearGradient id={`hc-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--brand-600)" stopOpacity="0.16" />
            <stop offset="1" stopColor="var(--brand-600)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={PAD_X}
            x2={W - PAD_X}
            y1={PAD_Y + (height - PAD_Y * 2) * f}
            y2={PAD_Y + (height - PAD_Y * 2) * f}
            stroke="var(--ink-300)"
            strokeOpacity="0.35"
            strokeDasharray="2 5"
          />
        ))}
        <path d={area} fill={`url(#hc-${id})`} />
        <path
          d={line}
          fill="none"
          stroke="var(--brand-600)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {hover !== null && hoverPoint ? (
          <g>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={PAD_Y}
              y2={height - PAD_Y}
              stroke="var(--ink-600)"
              strokeOpacity="0.5"
            />
            <circle
              cx={x(hover)}
              cy={y(hoverPoint.c)}
              r="4.5"
              fill="var(--brand-600)"
              stroke="var(--surface)"
              strokeWidth="2"
            />
          </g>
        ) : null}
      </svg>

      {hover !== null && hoverPoint ? (
        <div
          className="pointer-events-none absolute -top-1 z-10 -translate-x-1/2 rounded-lg border border-ink-300/60 bg-surface px-2.5 py-1.5 shadow-e2"
          style={{ left: `${(x(hover) / W) * 100}%` }}
          dir={locale === "fa" ? "rtl" : "ltr"}
        >
          <p className="num text-xs font-semibold whitespace-nowrap text-ink-900">
            {formatRate(hoverPoint.c, locale)}
          </p>
          <p className="text-[0.6875rem] whitespace-nowrap text-ink-600">
            {formatDate(hoverPoint.t, locale)}
          </p>
        </div>
      ) : null}

      <div
        className="mt-1 flex items-center justify-between text-[0.6875rem] text-ink-600"
        dir="ltr"
      >
        <span>{first ? formatDate(first.t, locale, { month: "short", day: "numeric" }) : ""}</span>
        <span className="num">
          {formatRate(min, locale)} – {formatRate(max, locale)}
        </span>
        <span>{last ? formatDate(last.t, locale, { month: "short", day: "numeric" }) : ""}</span>
      </div>
    </div>
  );
}
