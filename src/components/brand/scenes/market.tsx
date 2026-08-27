"use client";

import { motion, useReducedMotion } from "framer-motion";
import * as React from "react";
import { Breathe, DrawPath, Orbit, Rise, Scene, SceneCoin } from "@/components/brand/scene";
import {
  BRAND,
  CheckMark,
  DOWN,
  INK,
  LINE,
  Person,
  Sparks,
  SURFACE,
  UP,
  VaultShape,
  WARN,
} from "./_kit";

/**
 * The market side: what a thing costs today, and the two ways to buy it that
 * are not a remittance — gold, and another person.
 */

interface SceneProps {
  size?: number;
  className?: string;
  label?: string;
}

/** The board itself: rows of prices, refreshed while you watch. */
export function RateBoardScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <rect
          x="22"
          y="28"
          width="76"
          height="62"
          rx="8"
          fill={SURFACE}
          stroke={LINE}
          strokeWidth="3"
        />
      </Rise>
      {[0, 1, 2].map((i) => (
        <Rise key={i} delay={0.25 + i * 0.14}>
          <circle cx={34} cy={44 + i * 17} r="5" fill={i === 0 ? BRAND : LINE} />
          <rect x={44} y={42 + i * 17} width="22" height="4" rx="2" fill={LINE} />
          <rect
            x={72}
            y={42 + i * 17}
            width="16"
            height="4"
            rx="2"
            fill={i === 1 ? DOWN : UP}
            opacity="0.9"
          />
        </Rise>
      ))}
    </Scene>
  );
}

/** A price crossing the line somebody drew. */
export function RateAlertScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      <DrawPath d="M24 76l14-10 12 8 14-18 12 6 20-22" delay={0.2} width={3} color={BRAND} />
      <Rise delay={0.7}>
        <path d="M24 58h72" stroke={WARN} strokeWidth="3" strokeDasharray="5 5" />
      </Rise>
      <Breathe seconds={2.2} origin="86 40">
        <Rise delay={0.9}>
          <circle cx="86" cy="40" r="7" fill={WARN} />
        </Rise>
      </Breathe>
    </Scene>
  );
}

/** The alarm going off — the one moment a price is worth interrupting for. */
export function AlertFiredScene({ size, className, label }: SceneProps) {
  const reduce = useReducedMotion();
  return (
    <Scene size={size} className={className} label={label}>
      <motion.g
        style={{ transformOrigin: "60px 40px" }}
        animate={reduce ? undefined : { rotate: [-8, 8, -6, 6, 0] }}
        transition={reduce ? undefined : { duration: 1.4, repeat: Infinity, repeatDelay: 1.2 }}
      >
        <Rise delay={0.05}>
          <path
            d="M60 30a16 16 0 0 1 16 16v14l6 8H38l6-8V46a16 16 0 0 1 16-16Z"
            fill={SURFACE}
            stroke={BRAND}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path d="M54 74a6 6 0 0 0 12 0" stroke={BRAND} strokeWidth="3" strokeLinecap="round" />
        </Rise>
      </motion.g>
      <Rise delay={0.5}>
        <Sparks
          points={[
            [30, 42, 5],
            [92, 48, 4],
          ]}
          color={WARN}
        />
      </Rise>
    </Scene>
  );
}

/** Thirty days of it, so today's number has a shape behind it. */
export function TrendScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <path d="M24 84h72" stroke={LINE} strokeWidth="3" strokeLinecap="round" />
      </Rise>
      <DrawPath d="M26 78l16-12 14 6 16-20 20-10" delay={0.3} width={3.4} color={BRAND} />
      <Rise delay={0.9}>
        <circle cx="92" cy="42" r="6" fill={BRAND} />
        <circle cx="92" cy="42" r="11" fill={BRAND} opacity="0.16" />
      </Rise>
    </Scene>
  );
}

/** Buying a coin: the one product here you can hold. */
export function GoldCoinScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.1}>
        <SceneCoin cx={46} cy={62} r={18} tone="gold" />
      </Rise>
      <Rise delay={0.3}>
        <SceneCoin cx={72} cy={50} r={15} tone="gold" />
      </Rise>
      <Rise delay={0.55}>
        <Sparks
          points={[
            [92, 34, 5],
            [30, 38, 4],
          ]}
          color="#e8c169"
        />
      </Rise>
    </Scene>
  );
}

/** Held, counted, and somewhere specific. */
export function GoldVaultScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <VaultShape x={28} y={28} w={64} h={58} dial="#c9a227" />
      </Rise>
      <Rise delay={0.5}>
        <SceneCoin cx={60} cy={57} r={10} tone="gold" />
      </Rise>
    </Scene>
  );
}

/** An offer on the board: a person, a price, and terms. */
export function P2POfferScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <rect
          x="24"
          y="34"
          width="72"
          height="48"
          rx="8"
          fill={SURFACE}
          stroke={LINE}
          strokeWidth="3"
        />
      </Rise>
      <Rise delay={0.3}>
        <Person cx={36} cy={52} r={8} />
        <rect x="46" y="46" width="30" height="4" rx="2" fill={LINE} />
        <rect x="46" y="56" width="20" height="4" rx="2" fill={LINE} />
      </Rise>
      <Rise delay={0.6}>
        <rect x="46" y="68" width="40" height="8" rx="4" fill={BRAND} opacity="0.9" />
      </Rise>
    </Scene>
  );
}

/** Neither side holds the money while the other decides. */
export function P2PEscrowScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <Person cx={26} cy={48} r={9} />
        <Person cx={94} cy={48} r={9} />
      </Rise>
      <Rise delay={0.35}>
        <rect
          x="44"
          y="42"
          width="32"
          height="26"
          rx="6"
          fill={SURFACE}
          stroke={BRAND}
          strokeWidth="3"
        />
        <path
          d="M52 42v-5a8 8 0 0 1 16 0v5"
          stroke={BRAND}
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
      </Rise>
      <Rise delay={0.6}>
        <SceneCoin cx={60} cy={56} r={8} tone="brand" glyph="ت" />
      </Rise>
    </Scene>
  );
}

/** Trust, but earned and counted rather than claimed. */
export function ReputationScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <Person cx={60} cy={44} r={13} />
      </Rise>
      <Orbit seconds={14}>
        <Rise delay={0.4}>
          <circle cx="60" cy="20" r="4" fill={BRAND} />
          <circle cx="94" cy="62" r="4" fill={BRAND} opacity="0.7" />
          <circle cx="26" cy="62" r="4" fill={BRAND} opacity="0.5" />
        </Rise>
      </Orbit>
      <Rise delay={0.7}>
        <CheckMark cx={84} cy={84} r={12} color={UP} />
      </Rise>
    </Scene>
  );
}

/** Two currencies, one rate, no hidden third number. */
export function ConversionScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.08}>
        <SceneCoin cx={38} cy={54} r={15} tone="gold" glyph="$" />
      </Rise>
      <Rise delay={0.28}>
        <SceneCoin cx={82} cy={54} r={15} tone="brand" glyph="ت" />
      </Rise>
      <DrawPath d="M50 42h20" delay={0.6} width={3} color={INK} loop />
      <DrawPath d="M70 66H50" delay={0.75} width={3} color={INK} loop />
      <Rise delay={0.95}>
        <path d="M70 38l7 4-7 4Z" fill={INK} />
        <path d="M50 62l-7 4 7 4Z" fill={INK} />
      </Rise>
    </Scene>
  );
}
