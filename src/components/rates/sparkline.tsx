import * as React from "react";
import { cn } from "@/lib/utils";

interface SparklineProps {
  points: number[];
  width?: number;
  height?: number;
  tone?: "up" | "down" | "neutral";
  className?: string;
}

/**
 * Micro-sparkline: 2px line, no axes, subtle area fill. Time flows
 * left→right in both locales (financial convention), hence dir="ltr".
 */
export function Sparkline({
  points,
  width = 96,
  height = 30,
  tone = "neutral",
  className,
}: SparklineProps) {
  const id = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  if (points.length < 2) {
    return <span className={cn("inline-block", className)} style={{ width, height }} />;
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const pad = 2;
  const step = (width - pad * 2) / (points.length - 1);
  const y = (v: number) => pad + (height - pad * 2) * (1 - (v - min) / span);
  const coords = points.map((v, i) => `${(pad + i * step).toFixed(2)},${y(v).toFixed(2)}`);
  const line = `M${coords.join(" L")}`;
  const area = `${line} L${(width - pad).toFixed(2)},${height - pad} L${pad},${height - pad} Z`;

  const stroke = tone === "up" ? "var(--up)" : tone === "down" ? "var(--down)" : "var(--ink-600)";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
      className={cn("shrink-0", className)}
    >
      <defs>
        <linearGradient id={`sp-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={stroke} stopOpacity="0.18" />
          <stop offset="1" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sp-${id})`} />
      <path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
