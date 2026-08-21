"use client";

import { motion, useReducedMotion, type Transition } from "framer-motion";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The shared stage for every branded illustration (§2.6).
 *
 * One rig, used by all scenes so they read as a family: a brand-tinted disc,
 * a soft contact shadow beneath it, and a 120×120 drawing field with the same
 * stroke language as the logo (rounded caps, ~3-unit strokes, no fills that
 * aren't tokens). Scenes never introduce their own colors — everything comes
 * from the CSS variables, so light/dark and RTL come for free.
 */

export const SCENE_VIEWBOX = "0 0 120 120";

/** §13 easings. */
export const EASE_IN: Transition["ease"] = [0.22, 1, 0.36, 1];
export const EASE_OUT: Transition["ease"] = [0.4, 0, 1, 1];

interface SceneProps {
  size?: number;
  className?: string;
  children: React.ReactNode;
  /** Hide the tinted disc for scenes that carry their own ground. */
  bare?: boolean;
  label?: string;
}

export function Scene({ size = 160, className, children, bare, label }: SceneProps) {
  return (
    <div
      className={cn("relative shrink-0 select-none", className)}
      style={{ width: size, height: size }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <svg viewBox={SCENE_VIEWBOX} width={size} height={size} fill="none">
        {!bare ? (
          <>
            <circle cx="60" cy="58" r="46" fill="var(--brand-50)" />
            <ellipse cx="60" cy="110" rx="34" ry="4.5" fill="var(--ink-900)" opacity="0.08" />
          </>
        ) : null}
        {children}
      </svg>
    </div>
  );
}

/** A stroke that draws itself in, then holds. Static under reduced motion. */
export function DrawPath({
  d,
  delay = 0,
  duration = 0.6,
  width = 3,
  color = "var(--brand-600)",
  opacity = 1,
  cap = "round",
  loop = false,
}: {
  d: string;
  delay?: number;
  duration?: number;
  width?: number;
  color?: string;
  opacity?: number;
  cap?: "round" | "butt";
  loop?: boolean;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.path
      d={d}
      stroke={color}
      strokeWidth={width}
      strokeLinecap={cap}
      strokeLinejoin="round"
      fill="none"
      opacity={opacity}
      initial={reduce ? false : { pathLength: 0 }}
      animate={reduce ? undefined : { pathLength: 1 }}
      transition={
        reduce
          ? undefined
          : loop
            ? { duration, delay, ease: EASE_IN, repeat: Infinity, repeatType: "reverse", repeatDelay: 0.4 }
            : { duration, delay, ease: EASE_IN }
      }
    />
  );
}

/** A shape that fades and lifts into place. */
export function Rise({
  children,
  delay = 0,
  y = 8,
  duration = 0.5,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  duration?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.g
      initial={reduce ? false : { opacity: 0, y }}
      animate={reduce ? undefined : { opacity: 1, y: 0 }}
      transition={reduce ? undefined : { duration, delay, ease: EASE_IN }}
    >
      {children}
    </motion.g>
  );
}

/** A calm, never-anxious loop — used for waiting states (§13). */
export function Orbit({
  children,
  seconds = 3,
  reverse = false,
  origin = "60 58",
}: {
  children: React.ReactNode;
  seconds?: number;
  reverse?: boolean;
  origin?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <g>{children}</g>;
  return (
    <motion.g
      style={{ transformOrigin: `${origin.split(" ")[0]}px ${origin.split(" ")[1]}px` }}
      animate={{ rotate: reverse ? -360 : 360 }}
      transition={{ duration: seconds, repeat: Infinity, ease: "linear" }}
    >
      {children}
    </motion.g>
  );
}

/** Gentle breathing pulse for idle emphasis. */
export function Breathe({
  children,
  seconds = 2.4,
  scale = 1.04,
  origin = "60 58",
}: {
  children: React.ReactNode;
  seconds?: number;
  scale?: number;
  origin?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <g>{children}</g>;
  const [ox, oy] = origin.split(" ");
  return (
    <motion.g
      style={{ transformOrigin: `${ox}px ${oy}px` }}
      animate={{ scale: [1, scale, 1] }}
      transition={{ duration: seconds, repeat: Infinity, ease: "easeInOut" }}
    >
      {children}
    </motion.g>
  );
}

/** The brand coin, reduced to scene scale — same silhouette as the 3D set. */
export function SceneCoin({
  cx,
  cy,
  r = 11,
  glyph,
  tone = "brand",
}: {
  cx: number;
  cy: number;
  r?: number;
  glyph?: string;
  tone?: "brand" | "gold" | "silver";
}) {
  const face =
    tone === "gold" ? "#e8c169" : tone === "silver" ? "#d8dfe6" : "var(--brand-600)";
  const edge =
    tone === "gold" ? "#b8891f" : tone === "silver" ? "#9aa7b3" : "var(--brand-700)";
  return (
    <g>
      <ellipse cx={cx} cy={cy + r * 0.16} rx={r} ry={r * 0.94} fill={edge} />
      <ellipse cx={cx} cy={cy} rx={r} ry={r * 0.94} fill={face} />
      <ellipse
        cx={cx}
        cy={cy}
        rx={r * 0.72}
        ry={r * 0.66}
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.4"
        strokeWidth={r * 0.09}
      />
      {glyph ? (
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={r * 0.95}
          fontWeight="700"
          fill="#ffffff"
          fillOpacity="0.92"
          fontFamily="Vazirmatn, Inter, sans-serif"
        >
          {glyph}
        </text>
      ) : null}
      <ellipse
        cx={cx - r * 0.32}
        cy={cy - r * 0.4}
        rx={r * 0.34}
        ry={r * 0.2}
        fill="#ffffff"
        opacity="0.34"
        transform={`rotate(-28 ${cx - r * 0.32} ${cy - r * 0.4})`}
      />
    </g>
  );
}
