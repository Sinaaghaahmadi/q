"use client";

import * as React from "react";
import { Breathe, DrawPath, Orbit, Rise, Scene } from "@/components/brand/scene";
import { BRAND, CheckMark, Doc, DOWN, LINE, Phone, SURFACE, TextLines, UP, WARN } from "./_kit";

/**
 * Proving who you are, and the three answers that come back.
 *
 * The wizard already had a scene per step. What it did not have was a picture
 * for the *verdict* — approved, more needed, refused — which is the screen
 * people actually return to, days later, to find out where they stand.
 */

interface SceneProps {
  size?: number;
  className?: string;
  label?: string;
}

/** The number is real and answers. */
export function PhoneVerifiedScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <Phone x={42} y={24} w={36} h={62} />
      </Rise>
      <Rise delay={0.4}>
        <CheckMark cx={60} cy={56} r={15} color={UP} />
      </Rise>
    </Scene>
  );
}

/** Approved: the limits open and the paperwork is behind you. */
export function VerifiedScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <Doc x={34} y={22} w={46} h={58} />
        <TextLines x={42} y={42} widths={[26, 18]} gap={9} />
      </Rise>
      <Breathe seconds={3} origin="84 76">
        <Rise delay={0.45}>
          <CheckMark cx={84} cy={76} r={16} color={UP} />
        </Rise>
      </Breathe>
    </Scene>
  );
}

/** Not refused — one more thing, and it says which. */
export function MoreInfoScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <Doc x={34} y={22} w={46} h={58} />
        <TextLines x={42} y={42} widths={[26, 14]} gap={9} />
      </Rise>
      <Rise delay={0.45}>
        <circle cx="84" cy="76" r="15" fill={WARN} />
        <path d="M84 69v9" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" />
        <circle cx="84" cy="84" r="2" fill="#fff" />
      </Rise>
    </Scene>
  );
}

/** Refused, with a reason — the screen nobody wants and everybody re-reads. */
export function RejectedScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <Doc x={34} y={22} w={46} h={58} />
        <TextLines x={42} y={42} widths={[26, 14]} gap={9} />
      </Rise>
      <Rise delay={0.45}>
        <circle cx="84" cy="76" r="15" fill={DOWN} />
      </Rise>
      <DrawPath d="M78 70l12 12M90 70l-12 12" delay={0.65} width={3.2} color="#fff" />
    </Scene>
  );
}

/** The second factor: a code that only this device can produce. */
export function TwoFactorScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <Phone x={40} y={24} w={40} h={64} />
      </Rise>
      <Rise delay={0.3}>
        <rect
          x="48"
          y="44"
          width="24"
          height="24"
          rx="6"
          fill={SURFACE}
          stroke={BRAND}
          strokeWidth="3"
        />
        <path d="M60 50v12M54 56h12" stroke={BRAND} strokeWidth="3" strokeLinecap="round" />
      </Rise>
      <Orbit seconds={9} origin="60 56">
        <Rise delay={0.6}>
          <circle cx="60" cy="24" r="4" fill={BRAND} />
        </Rise>
      </Orbit>
      <Rise delay={0.8}>
        <rect x="50" y="76" width="20" height="3" rx="1.5" fill={LINE} />
      </Rise>
    </Scene>
  );
}
