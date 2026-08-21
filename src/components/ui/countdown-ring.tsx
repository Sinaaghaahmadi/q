"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface CountdownRingProps {
  totalSeconds: number;
  remainingSeconds: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  /** mm:ss label rendered in the center (pre-localized by the caller). */
  label?: string;
}

/**
 * Rate-lock countdown (§13): the ring sweeps down; below 60s it turns amber
 * and pulses gently. Pure transform/opacity + stroke-dashoffset.
 */
export function CountdownRing({
  totalSeconds,
  remainingSeconds,
  size = 96,
  strokeWidth = 6,
  className,
  label,
}: CountdownRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = totalSeconds > 0 ? Math.max(0, Math.min(1, remainingSeconds / totalSeconds)) : 0;
  const offset = circumference * (1 - fraction);
  const urgent = remainingSeconds <= 60;

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      role="timer"
      aria-live="off"
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--ink-300)"
          strokeOpacity={0.45}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={urgent ? "var(--warn)" : "var(--brand-600)"}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn(
            "transition-[stroke-dashoffset,stroke] duration-1000 ease-linear",
            urgent && "animate-pulse",
          )}
        />
      </svg>
      {label ? (
        <span
          className={cn(
            "num absolute text-sm font-semibold",
            urgent ? "text-warn" : "text-ink-900",
          )}
        >
          {label}
        </span>
      ) : null}
    </div>
  );
}
