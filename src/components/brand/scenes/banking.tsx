"use client";

import * as React from "react";
import { Breathe, DrawPath, Rise, Scene, SceneCoin } from "@/components/brand/scene";
import { BankShape, BRAND, CardShape, CheckMark, DOWN, LINE, SURFACE, TextLines, UP } from "./_kit";

/**
 * Where the money lands.
 *
 * A destination account is the part of a remittance people get wrong, and the
 * part that costs a week when they do. These scenes are about the account
 * itself — the number being checked, the card being kept, the two banks at
 * either end of the corridor, and the ceiling on how much may cross it.
 */

interface SceneProps {
  size?: number;
  className?: string;
  label?: string;
}

/** An account number being checked digit by digit, before anything is sent. */
export function IbanScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <rect
          x="22"
          y="42"
          width="76"
          height="32"
          rx="7"
          fill={SURFACE}
          stroke={LINE}
          strokeWidth="3"
        />
      </Rise>
      <Rise delay={0.25}>
        <TextLines x={30} y={52} widths={[14, 46]} gap={10} color={LINE} width={4} />
      </Rise>
      <Rise delay={0.6}>
        <CheckMark cx={88} cy={78} r={14} color={UP} />
      </Rise>
    </Scene>
  );
}

/** A card kept for next time, so the number is typed once. */
export function BankCardScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <g opacity="0.45">
          <CardShape x={26} y={34} w={58} h={36} band={LINE} />
        </g>
      </Rise>
      <Rise delay={0.28}>
        <CardShape x={36} y={48} w={58} h={36} />
      </Rise>
      <Rise delay={0.55}>
        <TextLines x={44} y={72} widths={[22, 12]} gap={7} color={LINE} width={3} />
      </Rise>
    </Scene>
  );
}

/** The saved set — the shortlist a returning customer picks from. */
export function AccountsScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      {[0, 1, 2].map((i) => (
        <Rise key={i} delay={0.08 + i * 0.14}>
          <rect
            x={26}
            y={32 + i * 20}
            width="68"
            height="16"
            rx="5"
            fill={SURFACE}
            stroke={LINE}
            strokeWidth="3"
          />
          <circle cx={38} cy={40 + i * 20} r="4" fill={i === 0 ? BRAND : LINE} />
          <rect x={48} y={38 + i * 20} width={i === 0 ? 34 : 26} height="4" rx="2" fill={LINE} />
        </Rise>
      ))}
      <Breathe seconds={3} origin="94 40">
        <Rise delay={0.7}>
          <circle cx="94" cy="40" r="9" fill={BRAND} />
          <path d="M94 35v10M89 40h10" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
        </Rise>
      </Breathe>
    </Scene>
  );
}

/** Two banks, one corridor. The arc is the only part that is ours. */
export function BankRailsScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <BankShape cx={32} y={40} w={34} h={26} />
        <BankShape cx={88} y={40} w={34} h={26} />
      </Rise>
      <DrawPath d="M32 78C44 92 76 92 88 78" delay={0.5} width={3} color={BRAND} loop />
      <Rise delay={0.9}>
        <SceneCoin cx={60} cy={88} r={9} tone="brand" glyph="ت" />
      </Rise>
    </Scene>
  );
}

/** What the account is allowed to move, and what raises it. */
export function LimitsScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <rect
          x="30"
          y="34"
          width="60"
          height="52"
          rx="7"
          fill={SURFACE}
          stroke={LINE}
          strokeWidth="3"
        />
      </Rise>
      {[0, 1, 2].map((i) => (
        <Rise key={i} delay={0.3 + i * 0.16}>
          <rect
            x={40 + i * 15}
            y={72 - i * 12}
            width="10"
            height={8 + i * 12}
            rx="3"
            fill={i === 2 ? BRAND : LINE}
          />
        </Rise>
      ))}
      <DrawPath d="M36 44h48" delay={0.85} width={3} color={DOWN} opacity={0.8} />
    </Scene>
  );
}
