"use client";

import * as React from "react";
import { Breathe, DrawPath, Rise, Scene } from "@/components/brand/scene";
import { BRAND, CheckMark, Doc, LINE, Person, SURFACE, TextLines, UP } from "./_kit";

/**
 * Talking to a human.
 *
 * Every order here has a conversation attached to it, because a transfer that
 * has gone quiet is the thing people panic about. These four cover the shapes
 * that conversation takes.
 */

interface SceneProps {
  size?: number;
  className?: string;
  label?: string;
}

/** The order chat: two sides, one thread, kept with the order. */
export function ChatScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <path
          d="M24 34h48a6 6 0 0 1 6 6v20a6 6 0 0 1-6 6H44l-12 10V66h-8a6 6 0 0 1-6-6V40a6 6 0 0 1 6-6Z"
          fill={SURFACE}
          stroke={LINE}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <TextLines x={32} y={44} widths={[32, 22]} gap={9} />
      </Rise>
      <Breathe seconds={3} origin="86 74">
        <Rise delay={0.45}>
          <path
            d="M96 56H66a5 5 0 0 0-5 5v14a5 5 0 0 0 5 5h20l10 8V61a5 5 0 0 0-5-5Z"
            fill={BRAND}
            stroke={SURFACE}
            strokeWidth="3"
            strokeLinejoin="round"
          />
        </Rise>
      </Breathe>
    </Scene>
  );
}

/** A ticket opened: the question written down and numbered. */
export function TicketScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <Doc x={34} y={22} w={46} h={60} />
      </Rise>
      <Rise delay={0.3}>
        <TextLines x={42} y={44} widths={[28, 20, 24]} gap={9} />
      </Rise>
      <Rise delay={0.6}>
        <circle cx="84" cy="78" r="14" fill={BRAND} />
        <path
          d="M78 74a6 6 0 1 1 6 7v2"
          stroke="#fff"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
        <circle cx="84" cy="86" r="1.8" fill="#fff" />
      </Rise>
    </Scene>
  );
}

/** Answered — by a person, with a name, not a queue position. */
export function TicketAnsweredScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <Person cx={32} cy={50} r={10} />
      </Rise>
      <Rise delay={0.35}>
        <path
          d="M56 40h40a6 6 0 0 1 6 6v18a6 6 0 0 1-6 6H72l-10 8v-8h-6a6 6 0 0 1-6-6V46a6 6 0 0 1 6-6Z"
          fill={SURFACE}
          stroke={BRAND}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <TextLines x={64} y={50} widths={[26, 18]} gap={8} color={LINE} />
      </Rise>
      <Rise delay={0.7}>
        <CheckMark cx={38} cy={84} r={11} color={UP} />
      </Rise>
    </Scene>
  );
}

/** The answer that was already written, before anybody had to ask. */
export function HelpScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <circle cx="60" cy="56" r="28" fill={SURFACE} stroke={LINE} strokeWidth="3" />
      </Rise>
      <DrawPath d="M52 48a8 8 0 1 1 9 9v5" delay={0.4} width={3.4} color={BRAND} cap="round" />
      <Rise delay={0.9}>
        <circle cx="61" cy="70" r="2.6" fill={BRAND} />
      </Rise>
    </Scene>
  );
}
