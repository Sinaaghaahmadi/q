"use client";

import { motion, useReducedMotion } from "framer-motion";
import * as React from "react";
import { Breathe, DrawPath, Rise, Scene, SceneCoin } from "@/components/brand/scene";
import {
  BRAND,
  CheckMark,
  Clock,
  Counter,
  Doc,
  DOWN,
  INK,
  LINE,
  Person,
  Sparks,
  SURFACE,
  TextLines,
  VaultShape,
  WARN,
} from "./_kit";

/**
 * The order machine, drawn.
 *
 * A remittance is a sequence of states a person cannot see: the money is
 * somewhere, someone is doing something, and the app's only job between the
 * taps is to say which. A line of text does that; a drawing of it does it
 * before the line is read, and these are the states people ask support about.
 */

interface SceneProps {
  size?: number;
  className?: string;
  label?: string;
}

/** The pre-invoice: what it costs, before anything is committed. */
export function QuoteScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <Doc x={34} y={20} w={46} h={62} />
      </Rise>
      <Rise delay={0.2}>
        <TextLines x={42} y={40} widths={[24, 18]} gap={9} />
      </Rise>
      <DrawPath d="M42 60h30" delay={0.42} width={3} color={LINE} />
      <Rise delay={0.55}>
        <rect x="42" y="66" width="22" height="4" rx="2" fill={BRAND} />
      </Rise>
      <Rise delay={0.7}>
        <SceneCoin cx={82} cy={72} r={13} tone="brand" glyph="ت" />
      </Rise>
    </Scene>
  );
}

/** Fifteen minutes, held. The padlock is the promise; the clock is the cost. */
export function RateLockScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <Clock cx={54} cy={54} r={24} hand={110} />
      </Rise>
      <Breathe seconds={3} origin="82 74">
        <Rise delay={0.35}>
          <rect x="70" y="66" width="24" height="20" rx="5" fill={BRAND} />
          <path
            d="M76 66v-5a6 6 0 0 1 12 0v5"
            stroke={BRAND}
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
          <circle cx="82" cy="76" r="3" fill="#fff" />
        </Rise>
      </Breathe>
    </Scene>
  );
}

/** The lock let go. The arrow is the way out, not a scolding. */
export function RateExpiredScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <Clock cx={60} cy={52} r={23} hand={358} stroke={WARN} />
      </Rise>
      {/* the re-quote, drawn as the circular arrow it is on the button */}
      <DrawPath d="M40 86a22 22 0 1 0 6-16" delay={0.5} width={3.2} color={BRAND} loop />
      <Rise delay={1}>
        <path d="M46 62l1 11 10-6Z" fill={BRAND} />
      </Rise>
    </Scene>
  );
}

/** Waiting for the rial to arrive. The card is the customer's move. */
export function AwaitingDepositScene({ size, className, label }: SceneProps) {
  const reduce = useReducedMotion();
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <Counter y={70} />
      </Rise>
      <motion.g
        initial={{ y: -18, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={
          reduce ? { duration: 0 } : { duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }
        }
      >
        <SceneCoin cx={60} cy={44} r={14} tone="brand" glyph="ت" />
      </motion.g>
      <DrawPath d="M60 60v6" delay={0.9} width={3} color={LINE} loop />
    </Scene>
  );
}

/** The rial is in, and it is not the office's yet — that is what escrow means. */
export function DepositHeldScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <VaultShape x={30} y={30} w={60} h={56} />
      </Rise>
      <Rise delay={0.5}>
        <SceneCoin cx={60} cy={58} r={9} tone="brand" glyph="ت" />
      </Rise>
      <Rise delay={0.7}>
        <Sparks points={[[96, 36, 4]]} />
      </Rise>
    </Scene>
  );
}

/** An office reading the request before it accepts it. */
export function OfficeReviewScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <Doc x={30} y={24} w={44} h={56} />
      </Rise>
      <Rise delay={0.25}>
        <TextLines x={38} y={44} widths={[26, 20, 14]} gap={8} />
      </Rise>
      <Breathe seconds={3.2} origin="76 64">
        <Rise delay={0.5}>
          <circle cx="76" cy="60" r="14" fill={SURFACE} stroke={BRAND} strokeWidth="3" />
          <path d="M86 70l10 10" stroke={BRAND} strokeWidth="4" strokeLinecap="round" />
        </Rise>
      </Breathe>
    </Scene>
  );
}

/** The foreign leg leaves. The arc is the corridor, not decoration. */
export function ForeignLegSentScene({ size, className, label }: SceneProps) {
  const reduce = useReducedMotion();
  return (
    <Scene size={size} className={className} label={label}>
      <DrawPath d="M26 78C40 40 80 40 94 74" delay={0.15} width={3} color={LINE} />
      <Rise delay={0.1}>
        <circle cx="26" cy="78" r="5" fill={BRAND} />
        <circle cx="94" cy="74" r="5" fill="none" stroke={BRAND} strokeWidth="3" />
      </Rise>
      <motion.g
        initial={{ offsetDistance: "0%" }}
        animate={reduce ? { offsetDistance: "0%" } : { offsetDistance: "100%" }}
        transition={
          reduce
            ? { duration: 0 }
            : { duration: 2.6, delay: 0.6, repeat: Infinity, ease: "easeInOut" }
        }
        style={{ offsetPath: 'path("M26 78C40 40 80 40 94 74")', offsetRotate: "0deg" }}
      >
        <SceneCoin cx={0} cy={0} r={11} tone="gold" glyph="€" />
      </motion.g>
    </Scene>
  );
}

/** Somebody, somewhere else, has the money in their hand. */
export function RecipientPaidScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <Person cx={48} cy={44} r={12} />
      </Rise>
      <Rise delay={0.4}>
        <SceneCoin cx={82} cy={58} r={13} tone="gold" glyph="€" />
      </Rise>
      <Rise delay={0.65}>
        <CheckMark cx={86} cy={84} r={13} />
      </Rise>
    </Scene>
  );
}

/** Cash over a counter — how most of these corridors actually end. */
export function CashPickupScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <Counter y={66} />
      </Rise>
      <Rise delay={0.3}>
        <rect
          x="42"
          y="38"
          width="36"
          height="22"
          rx="3"
          fill={SURFACE}
          stroke={LINE}
          strokeWidth="3"
        />
        <circle cx="60" cy="49" r="6" fill="none" stroke={BRAND} strokeWidth="3" />
      </Rise>
      <DrawPath d="M40 34h40" delay={0.6} width={3} color={LINE} />
    </Scene>
  );
}

/** Stopped before it moved. Grey, not red: nothing went wrong. */
export function OrderCancelledScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <Doc x={38} y={22} w={44} h={58} stroke={LINE} />
      </Rise>
      <Rise delay={0.3}>
        <TextLines x={46} y={44} widths={[24, 16]} gap={9} />
      </Rise>
      <Rise delay={0.5}>
        <circle cx="80" cy="80" r="15" fill={INK} opacity="0.9" />
      </Rise>
      <DrawPath d="M74 74l12 12M86 74l-12 12" delay={0.7} width={3.2} color="#fff" />
    </Scene>
  );
}

/** The money came back. Same arc as the corridor, run backwards. */
export function RefundScene({ size, className, label }: SceneProps) {
  const reduce = useReducedMotion();
  return (
    <Scene size={size} className={className} label={label}>
      <DrawPath d="M94 74C80 40 40 40 26 78" delay={0.15} width={3} color={LINE} />
      <motion.g
        initial={{ offsetDistance: "0%" }}
        animate={reduce ? { offsetDistance: "0%" } : { offsetDistance: "100%" }}
        transition={
          reduce
            ? { duration: 0 }
            : { duration: 2.4, delay: 0.5, repeat: Infinity, ease: "easeInOut" }
        }
        style={{ offsetPath: 'path("M94 74C80 40 40 40 26 78")', offsetRotate: "0deg" }}
      >
        <SceneCoin cx={0} cy={0} r={11} tone="brand" glyph="ت" />
      </motion.g>
      <Rise delay={0.2}>
        <circle cx="26" cy="78" r="6" fill={BRAND} />
      </Rise>
    </Scene>
  );
}

/** Two accounts of the same event. Somebody has to decide. */
export function DisputeScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <rect
          x="20"
          y="34"
          width="34"
          height="44"
          rx="5"
          fill={SURFACE}
          stroke={LINE}
          strokeWidth="3"
        />
        <rect
          x="66"
          y="34"
          width="34"
          height="44"
          rx="5"
          fill={SURFACE}
          stroke={LINE}
          strokeWidth="3"
        />
      </Rise>
      <Rise delay={0.3}>
        <TextLines x={27} y={46} widths={[18, 12]} gap={8} />
        <TextLines x={73} y={46} widths={[18, 12]} gap={8} />
      </Rise>
      <Breathe seconds={2.6} origin="60 72">
        <Rise delay={0.55}>
          <path
            d="M60 56l14 26H46Z"
            fill={WARN}
            stroke={SURFACE}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path d="M60 66v6" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
          <circle cx="60" cy="77" r="1.8" fill="#fff" />
        </Rise>
      </Breathe>
    </Scene>
  );
}

/** A transfer that failed at the far end, and is on its way back. */
export function FailedLegScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      <DrawPath d="M26 78C40 44 74 42 88 62" delay={0.15} width={3} color={LINE} />
      <Rise delay={0.1}>
        <circle cx="26" cy="78" r="5" fill={BRAND} />
      </Rise>
      <Rise delay={0.5}>
        <circle cx="90" cy="68" r="15" fill={DOWN} />
      </Rise>
      <DrawPath d="M84 62l12 12M96 62l-12 12" delay={0.75} width={3.2} color="#fff" />
    </Scene>
  );
}
