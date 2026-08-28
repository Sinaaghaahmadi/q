"use client";

import * as React from "react";

/**
 * The parts every scene is built from.
 *
 * Fifty illustrations drawn one path at a time would be fifty slightly
 * different phones and fifty slightly different documents — which is how an
 * illustration set stops looking like a set. These are the recurring objects of
 * this particular business, drawn once: a handset, a sheet of paper, a bank
 * card, a counter, a vault, a coin already lives in `scene.tsx`.
 *
 * Everything takes its colour from a token, so light, dark and RTL come for
 * free and no scene can introduce a hue the product does not have.
 */

export const INK = "var(--ink-600)";
export const LINE = "var(--ink-300)";
export const BRAND = "var(--brand-600)";
export const BRAND_DEEP = "var(--brand-700)";
export const SURFACE = "var(--surface)";
export const CANVAS = "var(--canvas)";
export const UP = "var(--up)";
export const DOWN = "var(--down)";
export const WARN = "var(--warn)";
export const INFO = "var(--info)";

/** A handset, the way the sign-in and alert scenes draw one. */
export function Phone({
  x = 40,
  y = 24,
  w = 40,
  h = 68,
  fill = SURFACE,
  stroke = LINE,
}: {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  fill?: string;
  stroke?: string;
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={9} fill={fill} stroke={stroke} strokeWidth="3" />
      <rect x={x + w / 2 - 7} y={y + 5} width="14" height="3" rx="1.5" fill={stroke} />
    </g>
  );
}

/** A sheet of paper with the corner turned — every document in the product. */
export function Doc({
  x = 42,
  y = 24,
  w = 38,
  h = 50,
  fold = 11,
  fill = SURFACE,
  stroke = LINE,
}: {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  fold?: number;
  fill?: string;
  stroke?: string;
}) {
  return (
    <g>
      <path
        d={`M${x} ${y + 4}a4 4 0 0 1 4-4h${w - fold - 4}l${fold} ${fold}v${h - fold - 4}a4 4 0 0 1-4 4H${x + 4}a4 4 0 0 1-4-4Z`}
        fill={fill}
        stroke={stroke}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d={`M${x + w - fold} ${y}v${fold}h${fold}`}
        fill="none"
        stroke={stroke}
        strokeWidth="3"
        strokeLinejoin="round"
      />
    </g>
  );
}

/** Ruled lines of text inside a document or a card. */
export function TextLines({
  x,
  y,
  widths,
  gap = 8,
  color = LINE,
  width = 3,
}: {
  x: number;
  y: number;
  widths: number[];
  gap?: number;
  color?: string;
  width?: number;
}) {
  return (
    <g>
      {widths.map((w, i) => (
        <rect key={i} x={x} y={y + i * gap} width={w} height={width} rx={width / 2} fill={color} />
      ))}
    </g>
  );
}

/** A bank card, for the destination-account scenes. */
export function CardShape({
  x = 30,
  y = 42,
  w = 60,
  h = 38,
  fill = SURFACE,
  stroke = LINE,
  band = BRAND,
}: {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  fill?: string;
  stroke?: string;
  band?: string;
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={6} fill={fill} stroke={stroke} strokeWidth="3" />
      <rect x={x} y={y + 8} width={w} height="7" fill={band} opacity="0.85" />
    </g>
  );
}

/** A bank: pediment, columns, steps. The counterparty at both ends. */
export function BankShape({
  cx = 60,
  y = 40,
  w = 52,
  h = 34,
  stroke = LINE,
  fill = SURFACE,
}: {
  cx?: number;
  y?: number;
  w?: number;
  h?: number;
  stroke?: string;
  fill?: string;
}) {
  const left = cx - w / 2;
  return (
    <g>
      <path
        d={`M${left - 4} ${y + 8}L${cx} ${y - 8}l${w / 2 + 4} ${16}Z`}
        fill={fill}
        stroke={stroke}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <rect
        x={left}
        y={y + 8}
        width={w}
        height={h - 8}
        fill={fill}
        stroke={stroke}
        strokeWidth="3"
      />
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={left + 8 + i * ((w - 22) / 2)}
          y={y + 14}
          width="5"
          height={h - 20}
          rx="2"
          fill={stroke}
          opacity="0.7"
        />
      ))}
    </g>
  );
}

/** The counter an exchange office works behind. */
export function Counter({
  y = 66,
  stroke = LINE,
  fill = SURFACE,
}: {
  y?: number;
  stroke?: string;
  fill?: string;
}) {
  return (
    <g>
      <rect
        x="24"
        y={y}
        width="72"
        height="10"
        rx="3"
        fill={fill}
        stroke={stroke}
        strokeWidth="3"
      />
      <rect
        x="30"
        y={y + 10}
        width="60"
        height="16"
        rx="3"
        fill={fill}
        stroke={stroke}
        strokeWidth="3"
      />
    </g>
  );
}

/** A clock face. `hand` is the minute hand's angle in degrees from 12. */
export function Clock({
  cx = 60,
  cy = 56,
  r = 22,
  hand = 60,
  stroke = BRAND,
  fill = SURFACE,
}: {
  cx?: number;
  cy?: number;
  r?: number;
  hand?: number;
  stroke?: string;
  fill?: string;
}) {
  const rad = ((hand - 90) * Math.PI) / 180;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={fill} stroke={stroke} strokeWidth="3" />
      <path
        d={`M${cx} ${cy}V${cy - r * 0.5}`}
        stroke={stroke}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d={`M${cx} ${cy}L${cx + Math.cos(rad) * r * 0.66} ${cy + Math.sin(rad) * r * 0.66}`}
        stroke={stroke}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </g>
  );
}

/** A shield — authority, protection, the compliance scenes. */
export function ShieldShape({
  cx = 60,
  y = 28,
  w = 44,
  h = 56,
  fill = SURFACE,
  stroke = BRAND,
}: {
  cx?: number;
  y?: number;
  w?: number;
  h?: number;
  fill?: string;
  stroke?: string;
}) {
  const half = w / 2;
  return (
    <path
      d={`M${cx} ${y}l${half} ${h * 0.16}v${h * 0.4}c0 ${h * 0.26}-${half * 0.55} ${h * 0.36}-${half} ${h * 0.44}c-${half * 0.45}-${h * 0.08}-${half}-${h * 0.18}-${half}-${h * 0.44}V${y + h * 0.16}Z`}
      fill={fill}
      stroke={stroke}
      strokeWidth="3"
      strokeLinejoin="round"
    />
  );
}

/** A vault door — escrow, and the gold that is actually held somewhere. */
export function VaultShape({
  x = 30,
  y = 32,
  w = 60,
  h = 56,
  stroke = LINE,
  fill = SURFACE,
  dial = BRAND,
}: {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  stroke?: string;
  fill?: string;
  dial?: string;
}) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const r = Math.min(w, h) * 0.2;
  return (
    <g>
      {/* the frame, then the door inset inside it — without the second
          rectangle the dial reads as a crosshair on a plain box */}
      <rect x={x} y={y} width={w} height={h} rx={8} fill={fill} stroke={stroke} strokeWidth="3" />
      <rect
        x={x + 6}
        y={y + 6}
        width={w - 12}
        height={h - 12}
        rx={5}
        fill="none"
        stroke={stroke}
        strokeWidth="3"
        opacity="0.55"
      />
      <circle cx={cx} cy={cy} r={r} fill={fill} stroke={dial} strokeWidth="3" />
      <circle cx={cx} cy={cy} r={r * 0.3} fill={dial} />
      {[45, 135, 225, 315].map((a) => {
        const rad = (a * Math.PI) / 180;
        return (
          <path
            key={a}
            d={`M${cx + Math.cos(rad) * r * 1.05} ${cy + Math.sin(rad) * r * 1.05}L${cx + Math.cos(rad) * r * 1.5} ${cy + Math.sin(rad) * r * 1.5}`}
            stroke={dial}
            strokeWidth="3"
            strokeLinecap="round"
          />
        );
      })}
      {/* handle bar on the opening edge */}
      <rect x={x + w - 5} y={cy - 7} width="8" height="14" rx="3" fill={stroke} />
    </g>
  );
}

/** A person, head and shoulders — a customer, an operator, a recipient. */
export function Person({
  cx = 60,
  cy = 46,
  r = 11,
  stroke = LINE,
  fill = SURFACE,
}: {
  cx?: number;
  cy?: number;
  r?: number;
  stroke?: string;
  fill?: string;
}) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={fill} stroke={stroke} strokeWidth="3" />
      <path
        d={`M${cx - r * 1.7} ${cy + r * 2.6}a${r * 1.7} ${r * 1.5} 0 0 1 ${r * 3.4} 0`}
        fill={fill}
        stroke={stroke}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </g>
  );
}

/** A tick inside a disc — the universal "this one is done". */
export function CheckMark({
  cx = 60,
  cy = 58,
  r = 15,
  color = BRAND,
}: {
  cx?: number;
  cy?: number;
  r?: number;
  color?: string;
}) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={color} />
      <path
        d={`M${cx - r * 0.42} ${cy}l${r * 0.3} ${r * 0.32} ${r * 0.55}-${r * 0.62}`}
        stroke="#fff"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </g>
  );
}

/** Small sparks, for the scenes that are genuinely good news. */
export function Sparks({
  points,
  color = BRAND,
}: {
  points: [number, number, number][];
  color?: string;
}) {
  return (
    <g>
      {points.map(([x, y, r], i) => (
        <path
          key={i}
          d={`M${x} ${y - r}L${x + r * 0.34} ${y - r * 0.34} ${x + r} ${y} ${x + r * 0.34} ${y + r * 0.34} ${x} ${y + r} ${x - r * 0.34} ${y + r * 0.34} ${x - r} ${y} ${x - r * 0.34} ${y - r * 0.34}Z`}
          fill={color}
          opacity="0.75"
        />
      ))}
    </g>
  );
}
