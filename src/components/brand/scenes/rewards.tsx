"use client";

import * as React from "react";
import { Breathe, DrawPath, Rise, Scene, SceneCoin } from "@/components/brand/scene";
import { BRAND, CheckMark, LINE, Person, Sparks, SURFACE, UP } from "./_kit";

/**
 * What coming back is worth.
 *
 * The tier and the referral are the only two places this product pays the
 * customer rather than the other way round, so they are the two that earn a
 * drawing rather than a line of small print.
 */

interface SceneProps {
  size?: number;
  className?: string;
  label?: string;
}

/** The climb: volume behind you, a lower fee ahead. */
export function TierScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      {[0, 1, 2].map((i) => (
        <Rise key={i} delay={0.1 + i * 0.16}>
          <rect
            x={30 + i * 20}
            y={76 - i * 14}
            width="16"
            height={12 + i * 14}
            rx="4"
            fill={i === 2 ? BRAND : LINE}
          />
        </Rise>
      ))}
      <DrawPath d="M32 62l20-12 20-12 18-6" delay={0.65} width={3} color={BRAND} />
      <Rise delay={1}>
        <path d="M88 26l6 8h-12Z" fill={BRAND} />
      </Rise>
    </Scene>
  );
}

/** A step actually taken — the moment the fee drops. */
export function TierUpScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <path
          d="M60 24l9 18 20 3-14 14 3 20-18-9-18 9 3-20-14-14 20-3Z"
          fill={SURFACE}
          stroke={BRAND}
          strokeWidth="3"
          strokeLinejoin="round"
        />
      </Rise>
      <Breathe seconds={2.8} origin="60 52">
        <Rise delay={0.4}>
          <CheckMark cx={60} cy={52} r={11} />
        </Rise>
      </Breathe>
      <Rise delay={0.7}>
        <Sparks
          points={[
            [30, 40, 5],
            [92, 44, 4],
            [60, 92, 4],
          ]}
        />
      </Rise>
    </Scene>
  );
}

/** One person telling another. The whole growth model, drawn. */
export function ReferralScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <Person cx={32} cy={48} r={10} />
      </Rise>
      <DrawPath d="M46 62h28" delay={0.4} width={3} color={BRAND} loop />
      <Rise delay={0.75}>
        <path d="M74 58l7 4-7 4Z" fill={BRAND} />
        <Person cx={88} cy={48} r={10} stroke={BRAND} />
      </Rise>
    </Scene>
  );
}

/** The reward, once the friend's first transfer actually completes. */
export function RewardPaidScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <rect
          x="34"
          y="46"
          width="52"
          height="38"
          rx="6"
          fill={SURFACE}
          stroke={BRAND}
          strokeWidth="3"
        />
        <rect x="34" y="46" width="52" height="10" rx="4" fill={BRAND} />
        <path d="M60 46v38" stroke={BRAND} strokeWidth="3" />
      </Rise>
      <Rise delay={0.45}>
        <path
          d="M60 46c-6-14-20-10-16-2 3 6 10 4 16 2Zm0 0c6-14 20-10 16-2-3 6-10 4-16 2Z"
          fill={SURFACE}
          stroke={BRAND}
          strokeWidth="3"
          strokeLinejoin="round"
        />
      </Rise>
      <Rise delay={0.7}>
        <SceneCoin cx={92} cy={82} r={11} tone="brand" glyph="ت" />
      </Rise>
    </Scene>
  );
}

/** Money kept back rather than spent — the savings side of the tier. */
export function SavingsScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <path
          d="M32 60a24 20 0 0 1 48 0v14a6 6 0 0 1-6 6H38a6 6 0 0 1-6-6Z"
          fill={SURFACE}
          stroke={LINE}
          strokeWidth="3"
        />
        <path d="M80 62h8v10h-8" fill={SURFACE} stroke={LINE} strokeWidth="3" />
        <rect x="48" y="36" width="16" height="4" rx="2" fill={LINE} />
      </Rise>
      <Rise delay={0.45}>
        <SceneCoin cx={56} cy={30} r={10} tone="brand" glyph="ت" />
      </Rise>
      <Rise delay={0.75}>
        <CheckMark cx={88} cy={86} r={11} color={UP} />
      </Rise>
    </Scene>
  );
}
