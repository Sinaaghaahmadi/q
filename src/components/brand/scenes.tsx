"use client";

import { motion, useReducedMotion } from "framer-motion";
import * as React from "react";
import {
  Breathe,
  DrawPath,
  EASE_IN,
  Orbit,
  Rise,
  Scene,
  SceneCoin,
} from "@/components/brand/scene";

/**
 * The Asaex illustration set (§2.6, §13).
 *
 * Every scene shares one rig — the tinted disc, the contact shadow, the
 * rounded 3-unit stroke of the logo, and the coin silhouette of the currency
 * icons — so onboarding, KYC, waiting and success all read as one product.
 * They are SVG + Framer Motion rather than imported Lottie files: a few KB
 * each, theme-aware through CSS variables, and static under
 * `prefers-reduced-motion` by construction.
 */

interface SceneProps {
  size?: number;
  className?: string;
  label?: string;
}

const INK = "var(--ink-600)";
const LINE = "var(--ink-300)";
const BRAND = "var(--brand-600)";

/** Phone receiving a one-time code — the sign-in step. */
export function OtpScene({ size, className, label }: SceneProps) {
  const reduce = useReducedMotion();
  return (
    <Scene size={size} className={className} label={label}>
      {/* handset */}
      <Rise delay={0.05}>
        <rect
          x="40"
          y="26"
          width="40"
          height="66"
          rx="9"
          fill="var(--surface)"
          stroke={LINE}
          strokeWidth="3"
        />
        <rect x="53" y="31" width="14" height="3" rx="1.5" fill={LINE} />
      </Rise>

      {/* code digits landing one by one */}
      {[0, 1, 2, 3].map((i) => (
        <motion.g
          key={i}
          initial={reduce ? false : { opacity: 0, y: 10, scale: 0.8 }}
          animate={reduce ? undefined : { opacity: 1, y: 0, scale: 1 }}
          transition={reduce ? undefined : { delay: 0.45 + i * 0.13, duration: 0.4, ease: EASE_IN }}
        >
          <rect x={45 + i * 8.4} y="52" width="6.4" height="9" rx="2" fill={BRAND} opacity="0.9" />
        </motion.g>
      ))}

      {/* message bubble arriving from the top-left */}
      <motion.g
        initial={reduce ? false : { opacity: 0, x: -10, y: -6 }}
        animate={reduce ? undefined : { opacity: 1, x: 0, y: 0 }}
        transition={reduce ? undefined : { delay: 0.25, duration: 0.5, ease: EASE_IN }}
      >
        <path
          d="M18 30h26a6 6 0 0 1 6 6v10a6 6 0 0 1-6 6H30l-7 6v-6h-5a6 6 0 0 1-6-6V36a6 6 0 0 1 6-6Z"
          fill={BRAND}
        />
        <circle cx="24" cy="41" r="2.2" fill="#fff" opacity="0.95" />
        <circle cx="31" cy="41" r="2.2" fill="#fff" opacity="0.75" />
        <circle cx="38" cy="41" r="2.2" fill="#fff" opacity="0.55" />
      </motion.g>

      <Breathe seconds={2.8} origin="60 82">
        <path d="M50 84h20" stroke={LINE} strokeWidth="3" strokeLinecap="round" />
      </Breathe>
    </Scene>
  );
}

/** Identity form filling itself in — the details step. */
export function IdentityScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <rect
          x="24"
          y="34"
          width="72"
          height="50"
          rx="10"
          fill="var(--surface)"
          stroke={LINE}
          strokeWidth="3"
        />
      </Rise>
      <Rise delay={0.2}>
        <circle cx="43" cy="53" r="9" fill="var(--brand-50)" stroke={BRAND} strokeWidth="2.5" />
        <circle cx="43" cy="50" r="3.2" fill={BRAND} />
        <path d="M37 59a6.4 6.4 0 0 1 12 0" fill={BRAND} />
      </Rise>
      <DrawPath d="M58 48h30" delay={0.45} duration={0.45} width={3} color={INK} opacity={0.5} />
      <DrawPath d="M58 57h22" delay={0.6} duration={0.4} width={3} color={LINE} />
      <DrawPath d="M34 72h52" delay={0.75} duration={0.5} width={3} color={LINE} />
      <Rise delay={1}>
        <circle cx="86" cy="72" r="7" fill={BRAND} />
        <path
          d="M83 72l2.2 2.4 4-4.6"
          stroke="#fff"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Rise>
    </Scene>
  );
}

/** Document being scanned, then stamped verified (§13 document upload). */
export function DocumentScene({ size, className, label }: SceneProps) {
  const reduce = useReducedMotion();
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <rect
          x="34"
          y="26"
          width="52"
          height="66"
          rx="8"
          fill="var(--surface)"
          stroke={LINE}
          strokeWidth="3"
        />
        <rect x="43" y="38" width="20" height="16" rx="4" fill="var(--brand-50)" />
        <circle cx="53" cy="45" r="4" fill={BRAND} opacity="0.55" />
      </Rise>
      <DrawPath d="M43 62h34" delay={0.3} width={3} color={LINE} />
      <DrawPath d="M43 70h24" delay={0.42} width={3} color={LINE} />
      <DrawPath d="M43 78h30" delay={0.54} width={3} color={LINE} />

      {/* scan-line sweep */}
      {!reduce ? (
        <motion.g
          initial={{ y: -34, opacity: 0 }}
          animate={{ y: [-34, 34, -34], opacity: [0, 1, 1, 0] }}
          transition={{
            duration: 2.6,
            repeat: Infinity,
            ease: "easeInOut",
            times: [0, 0.45, 0.55, 1],
          }}
        >
          <rect x="34" y="58" width="52" height="2.5" rx="1.25" fill={BRAND} />
          <rect x="34" y="52" width="52" height="8" fill={BRAND} opacity="0.12" />
        </motion.g>
      ) : null}

      {/* verified stamp settles in */}
      <motion.g
        initial={reduce ? false : { opacity: 0, scale: 1.5, rotate: -18 }}
        animate={reduce ? undefined : { opacity: 1, scale: 1, rotate: -12 }}
        transition={reduce ? undefined : { delay: 1.1, duration: 0.55, ease: EASE_IN }}
        style={{ transformOrigin: "80px 84px" }}
      >
        <circle cx="80" cy="84" r="14" fill="var(--surface)" stroke={BRAND} strokeWidth="2.5" />
        <path
          d="M74 84.5l4 4.2 8-9"
          stroke={BRAND}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </motion.g>
    </Scene>
  );
}

/** Guided selfie / liveness capture. */
export function LivenessScene({ size, className, label }: SceneProps) {
  const reduce = useReducedMotion();
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <ellipse
          cx="60"
          cy="56"
          rx="24"
          ry="30"
          fill="var(--surface)"
          stroke={LINE}
          strokeWidth="3"
        />
        <circle cx="52" cy="52" r="2.6" fill={INK} />
        <circle cx="68" cy="52" r="2.6" fill={INK} />
        <path
          d="M53 66a9 9 0 0 0 14 0"
          stroke={INK}
          strokeWidth="2.6"
          strokeLinecap="round"
          fill="none"
        />
      </Rise>

      {/* tracking ring sweeping around the face */}
      {!reduce ? (
        <motion.g
          animate={{ rotate: 360 }}
          transition={{ duration: 3.4, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "60px 56px" }}
        >
          <ellipse
            cx="60"
            cy="56"
            rx="31"
            ry="37"
            fill="none"
            stroke={BRAND}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="30 180"
          />
        </motion.g>
      ) : (
        <ellipse
          cx="60"
          cy="56"
          rx="31"
          ry="37"
          fill="none"
          stroke={BRAND}
          strokeWidth="3"
          strokeDasharray="30 180"
        />
      )}

      <ellipse
        cx="60"
        cy="56"
        rx="31"
        ry="37"
        fill="none"
        stroke={LINE}
        strokeWidth="2"
        strokeDasharray="4 7"
      />

      {/* head-turn hint */}
      <Rise delay={0.7}>
        <path
          d="M88 100h-14M78 96l-4 4 4 4"
          stroke={BRAND}
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Rise>
    </Scene>
  );
}

/** "Under review" — calm, never anxious (§13 waiting state). */
export function ReviewScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      <Orbit seconds={9}>
        <SceneCoin cx={60} cy={20} r={8} tone="gold" glyph="$" />
        <SceneCoin cx={95} cy={72} r={8} tone="silver" glyph="€" />
        <SceneCoin cx={25} cy={72} r={8} tone="brand" glyph="ت" />
      </Orbit>
      <Breathe seconds={3}>
        <circle cx="60" cy="58" r="22" fill="var(--surface)" stroke={LINE} strokeWidth="3" />
        <path
          d="M60 46v13l8 5"
          stroke={BRAND}
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Breathe>
    </Scene>
  );
}

/** Completion — checkmark draw + a restrained particle settle (§13). */
export function SuccessScene({ size, className, label }: SceneProps) {
  const reduce = useReducedMotion();
  const sparks = [
    { x: 26, y: 30 },
    { x: 94, y: 32 },
    { x: 20, y: 70 },
    { x: 100, y: 68 },
    { x: 60, y: 14 },
  ];
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <circle cx="60" cy="58" r="26" fill={BRAND} />
      </Rise>
      <DrawPath
        d="M49 58.5l7.5 7.8 14.5-16"
        delay={0.35}
        duration={0.55}
        width={5}
        color="#ffffff"
      />
      {sparks.map((s, i) =>
        reduce ? null : (
          <motion.circle
            key={i}
            cx={s.x}
            cy={s.y}
            r="2.6"
            fill={BRAND}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: [0, 1, 0], scale: [0, 1.2, 0.6] }}
            transition={{ delay: 0.7 + i * 0.06, duration: 0.9, ease: "easeOut" }}
          />
        ),
      )}
    </Scene>
  );
}

/** Saved destination accounts. */
export function AccountsScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.15}>
        <rect
          x="26"
          y="40"
          width="60"
          height="38"
          rx="8"
          fill="var(--brand-50)"
          stroke={LINE}
          strokeWidth="2.5"
        />
      </Rise>
      <Rise delay={0.05}>
        <rect
          x="34"
          y="50"
          width="60"
          height="38"
          rx="8"
          fill="var(--surface)"
          stroke={LINE}
          strokeWidth="3"
        />
        <rect x="34" y="59" width="60" height="7" fill={BRAND} opacity="0.85" />
        <rect x="41" y="73" width="22" height="4" rx="2" fill={LINE} />
        <rect x="68" y="73" width="12" height="4" rx="2" fill={LINE} />
      </Rise>
      <Rise delay={0.45}>
        <circle cx="88" cy="44" r="11" fill={BRAND} />
        <path d="M88 39v10M83 44h10" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" />
      </Rise>
    </Scene>
  );
}

/** Security / two-factor settings. */
export function SecurityScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <path
          d="M60 24l26 10v22c0 17-11 29-26 34-15-5-26-17-26-34V34l26-10Z"
          fill="var(--surface)"
          stroke={LINE}
          strokeWidth="3"
        />
      </Rise>
      <Rise delay={0.3}>
        <rect x="49" y="55" width="22" height="17" rx="4" fill={BRAND} />
        <path
          d="M53 55v-5a7 7 0 0 1 14 0v5"
          stroke={BRAND}
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="60" cy="63" r="2.6" fill="#fff" />
      </Rise>
    </Scene>
  );
}

/** Matching a request with an exchange office — the Phase-3 wait state. */
export function MatchingScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <path d="M36 54h48v34H36z" fill="var(--surface)" stroke={LINE} strokeWidth="3" />
        <path
          d="M30 54l30-18 30 18"
          stroke={BRAND}
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <rect
          x="46"
          y="64"
          width="10"
          height="10"
          rx="2"
          fill="var(--brand-50)"
          stroke={LINE}
          strokeWidth="2"
        />
        <rect
          x="64"
          y="64"
          width="10"
          height="10"
          rx="2"
          fill="var(--brand-50)"
          stroke={LINE}
          strokeWidth="2"
        />
        <rect x="54" y="78" width="12" height="10" rx="2" fill={BRAND} opacity="0.8" />
      </Rise>
      <Orbit seconds={7} origin="60 60">
        <SceneCoin cx={60} cy={16} r={7.5} tone="gold" glyph="$" />
        <SceneCoin cx={104} cy={60} r={7.5} tone="brand" glyph="ت" />
      </Orbit>
    </Scene>
  );
}

/** Empty order history. */
export function OrdersEmptyScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <path
          d="M38 24h34l12 12v58a4 4 0 0 1-4 4H38a4 4 0 0 1-4-4V28a4 4 0 0 1 4-4Z"
          fill="var(--surface)"
          stroke={LINE}
          strokeWidth="3"
        />
        <path d="M72 24v12h12" stroke={LINE} strokeWidth="3" strokeLinejoin="round" fill="none" />
      </Rise>
      <DrawPath d="M45 54h28" delay={0.3} width={3} color={LINE} />
      <DrawPath d="M45 64h20" delay={0.42} width={3} color={LINE} />
      <Rise delay={0.6}>
        <circle cx="72" cy="80" r="13" fill="var(--brand-50)" stroke={BRAND} strokeWidth="2.5" />
        <path d="M72 74v12M66 80h12" stroke={BRAND} strokeWidth="3" strokeLinecap="round" />
      </Rise>
    </Scene>
  );
}
