"use client";

import { motion, useReducedMotion } from "framer-motion";
import * as React from "react";
import { Breathe, DrawPath, Orbit, Rise, Scene, SceneCoin } from "@/components/brand/scene";
import {
  BankShape,
  BRAND,
  CheckMark,
  Counter,
  Doc,
  INK,
  LINE,
  Person,
  ShieldShape,
  SURFACE,
  UP,
  WARN,
} from "./_kit";

/**
 * The other side of the counter.
 *
 * An exchange office and the platform console are where the work actually
 * happens, and they were the two surfaces with no illustration at all — a
 * dense table and a heading. These are drawn for an operator who opens the
 * same screen sixty times a day and needs to know at a glance which one it is.
 */

interface SceneProps {
  size?: number;
  className?: string;
  label?: string;
}

/** A request landing in the office's inbox. */
export function InboxScene({ size, className, label }: SceneProps) {
  const reduce = useReducedMotion();
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <path
          d="M26 62h16l5 8h26l5-8h16v22a6 6 0 0 1-6 6H32a6 6 0 0 1-6-6Z"
          fill={SURFACE}
          stroke={LINE}
          strokeWidth="3"
          strokeLinejoin="round"
        />
      </Rise>
      <motion.g
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={
          reduce
            ? { duration: 0 }
            : { duration: 0.8, delay: 0.4, repeat: Infinity, repeatDelay: 1.6, ease: "easeOut" }
        }
      >
        <rect
          x="44"
          y="26"
          width="32"
          height="24"
          rx="4"
          fill={SURFACE}
          stroke={BRAND}
          strokeWidth="3"
        />
        <path d="M44 30l16 12 16-12" fill="none" stroke={BRAND} strokeWidth="3" />
      </motion.g>
    </Scene>
  );
}

/** End of day: what was taken in, what goes out, and the difference. */
export function SettlementScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <path d="M60 26v56" stroke={LINE} strokeWidth="3" strokeLinecap="round" />
        <path d="M34 40h52" stroke={LINE} strokeWidth="3" strokeLinecap="round" />
      </Rise>
      <Rise delay={0.3}>
        <path
          d="M24 56a10 10 0 0 0 20 0l-10-16Z"
          fill={SURFACE}
          stroke={BRAND}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path
          d="M76 56a10 10 0 0 0 20 0l-10-16Z"
          fill={SURFACE}
          stroke={BRAND}
          strokeWidth="3"
          strokeLinejoin="round"
        />
      </Rise>
      <Rise delay={0.6}>
        <SceneCoin cx={60} cy={90} r={10} tone="brand" glyph="ت" />
      </Rise>
    </Scene>
  );
}

/** The float: how much this office can actually pay out right now. */
export function LiquidityScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <path
          d="M38 30h44v46a12 12 0 0 1-12 12H50a12 12 0 0 1-12-12Z"
          fill={SURFACE}
          stroke={LINE}
          strokeWidth="3"
          strokeLinejoin="round"
        />
      </Rise>
      <Rise delay={0.35}>
        <path
          d="M40 60h40v16a12 12 0 0 1-12 12H52a12 12 0 0 1-12-12Z"
          fill={BRAND}
          opacity="0.85"
        />
      </Rise>
      <DrawPath d="M40 60h40" delay={0.7} width={3} color={BRAND} />
      <Rise delay={0.9}>
        <SceneCoin cx={60} cy={22} r={9} tone="gold" glyph="$" />
      </Rise>
    </Scene>
  );
}

/** The office's own prices, published for the day. */
export function RateSheetScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <Doc x={30} y={22} w={50} h={62} />
      </Rise>
      {[0, 1, 2].map((i) => (
        <Rise key={i} delay={0.28 + i * 0.14}>
          <circle cx={40} cy={44 + i * 14} r="4" fill={i === 0 ? BRAND : LINE} />
          <rect x={50} y={42 + i * 14} width="22" height="4" rx="2" fill={LINE} />
        </Rise>
      ))}
      <Rise delay={0.8}>
        <CheckMark cx={86} cy={80} r={13} color={UP} />
      </Rise>
    </Scene>
  );
}

/** Who is allowed behind this counter. */
export function TeamScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <Person cx={34} cy={48} r={8} />
        <Person cx={86} cy={48} r={8} />
      </Rise>
      <Rise delay={0.35}>
        <Person cx={60} cy={40} r={11} stroke={BRAND} />
      </Rise>
      <Rise delay={0.7}>
        <Counter y={78} />
      </Rise>
    </Scene>
  );
}

/** Every privileged act, written down and not editable. */
export function AuditScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <path d="M34 26v68" stroke={LINE} strokeWidth="3" strokeLinecap="round" />
      </Rise>
      {[0, 1, 2, 3].map((i) => (
        <Rise key={i} delay={0.2 + i * 0.13}>
          <circle
            cx="34"
            cy={36 + i * 17}
            r="5"
            fill={i === 0 ? BRAND : SURFACE}
            stroke={i === 0 ? BRAND : LINE}
            strokeWidth="3"
          />
          <rect x="48" y={34 + i * 17} width={i % 2 ? 26 : 38} height="4" rx="2" fill={LINE} />
        </Rise>
      ))}
    </Scene>
  );
}

/** A rule that fired, and a human who has to look at it. */
export function ComplianceScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <ShieldShape cx={60} y={24} w={48} h={62} />
      </Rise>
      <Breathe seconds={2.6} origin="60 58">
        <Rise delay={0.4}>
          <path d="M60 42v18" stroke={WARN} strokeWidth="4" strokeLinecap="round" />
          <circle cx="60" cy="70" r="2.8" fill={WARN} />
        </Rise>
      </Breathe>
    </Scene>
  );
}

/** A new office being brought onto the platform. */
export function OnboardOfficeScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <g transform="translate(0 6)">
          <BankShape cx={56} y={34} w={50} h={36} />
        </g>
      </Rise>
      <Breathe seconds={3} origin="90 40">
        <Rise delay={0.5}>
          <circle cx="90" cy="40" r="13" fill={BRAND} />
          <path d="M90 33v14M83 40h14" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
        </Rise>
      </Breathe>
    </Scene>
  );
}

/** Standing in somebody else's session, with the banner that says so. */
export function ImpersonationScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <Person cx={60} cy={48} r={14} />
      </Rise>
      <Rise delay={0.35}>
        <path
          d="M28 76h64a5 5 0 0 1 5 5v6a5 5 0 0 1-5 5H28a5 5 0 0 1-5-5v-6a5 5 0 0 1 5-5Z"
          fill={WARN}
          opacity="0.9"
        />
        <rect x="34" y="82" width="34" height="4" rx="2" fill="#fff" opacity="0.9" />
      </Rise>
      <Orbit seconds={11} origin="60 48">
        <Rise delay={0.6}>
          <circle cx="60" cy="26" r="4" fill={INK} opacity="0.5" />
        </Rise>
      </Orbit>
    </Scene>
  );
}
