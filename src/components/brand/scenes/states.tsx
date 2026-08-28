"use client";

import { motion, useReducedMotion } from "framer-motion";
import * as React from "react";
import { Breathe, DrawPath, Orbit, Rise, Scene, SceneCoin } from "@/components/brand/scene";
import { BRAND, Doc, INFO, INK, LINE, Phone, SURFACE, TextLines, WARN } from "./_kit";

/**
 * The honest dead ends.
 *
 * A screen with nothing on it is still a screen somebody is looking at, and
 * the difference between "you have not done this yet", "this is not yours",
 * "the address is wrong" and "the network is gone" is the whole message. Four
 * different drawings say it before the sentence under them is read.
 */

interface SceneProps {
  size?: number;
  className?: string;
  label?: string;
}

/** No orders yet — an empty tray, not an error. */
export function OrdersEmptyScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <Doc x={36} y={22} w={48} h={60} />
      </Rise>
      <Rise delay={0.3}>
        <TextLines x={44} y={44} widths={[26, 18]} gap={9} />
      </Rise>
      <Breathe seconds={3} origin="84 80">
        <Rise delay={0.6}>
          <circle cx="84" cy="80" r="14" fill={BRAND} />
          <path d="M84 73v14M77 80h14" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
        </Rise>
      </Breathe>
    </Scene>
  );
}

/** Searched, and nothing matched — the query, not the product, came up short. */
export function SearchEmptyScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <circle cx="54" cy="50" r="22" fill={SURFACE} stroke={LINE} strokeWidth="3" />
        <path d="M70 66l16 16" stroke={LINE} strokeWidth="4" strokeLinecap="round" />
      </Rise>
      <DrawPath d="M46 42l16 16M62 42l-16 16" delay={0.5} width={3} color={INK} opacity={0.6} />
    </Scene>
  );
}

/** A wrong address. The compass is a way back, not a telling-off. */
export function NotFoundScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <circle cx="60" cy="56" r="28" fill={SURFACE} stroke={LINE} strokeWidth="3" />
      </Rise>
      <Orbit seconds={12}>
        <Rise delay={0.4}>
          <path
            d="M72 44l-8 20-20 8 8-20Z"
            fill={BRAND}
            stroke={BRAND}
            strokeWidth="3"
            strokeLinejoin="round"
          />
        </Rise>
      </Orbit>
      <Rise delay={0.8}>
        <circle cx="60" cy="56" r="3" fill={SURFACE} />
      </Rise>
    </Scene>
  );
}

/** No network. The saved copy is still there — that is the point. */
export function OfflineScene({ size, className, label }: SceneProps) {
  const reduce = useReducedMotion();
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <Phone x={42} y={26} w={36} h={62} />
      </Rise>
      {[0, 1, 2].map((i) => (
        <motion.path
          key={i}
          d={`M${52 - i * 4} ${68 - i * 9}a${8 + i * 6} ${8 + i * 6} 0 0 1 ${16 + i * 8} 0`}
          stroke={i === 0 ? BRAND : LINE}
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          initial={reduce ? false : { opacity: 0 }}
          animate={reduce ? undefined : { opacity: i === 0 ? 1 : 0.35 }}
          transition={reduce ? undefined : { duration: 0.5, delay: 0.3 + i * 0.12 }}
        />
      ))}
      <DrawPath d="M34 24l52 68" delay={0.8} width={3.4} color={INK} />
    </Scene>
  );
}

/** A door that is not yours — not a mistake you made. */
export function NoAccessScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <rect
          x="38"
          y="52"
          width="44"
          height="34"
          rx="6"
          fill={SURFACE}
          stroke={LINE}
          strokeWidth="3"
        />
        <path
          d="M48 52v-9a12 12 0 0 1 24 0v9"
          fill="none"
          stroke={LINE}
          strokeWidth="3"
          strokeLinecap="round"
        />
      </Rise>
      <Rise delay={0.45}>
        <circle cx="60" cy="66" r="4.5" fill={INK} opacity="0.85" />
        <path d="M60 70v7" stroke={INK} strokeWidth="3" strokeLinecap="round" opacity="0.85" />
      </Rise>
    </Scene>
  );
}

/** Planned work, announced. The status page's own picture. */
export function MaintenanceScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <rect
          x="26"
          y="38"
          width="68"
          height="44"
          rx="7"
          fill={SURFACE}
          stroke={LINE}
          strokeWidth="3"
        />
        <path d="M26 52h68" stroke={LINE} strokeWidth="3" />
      </Rise>
      <Orbit seconds={7} origin="60 68">
        <Rise delay={0.4}>
          <circle cx="60" cy="68" r="10" fill="none" stroke={BRAND} strokeWidth="3" />
          {[0, 90, 180, 270].map((a) => {
            const rad = (a * Math.PI) / 180;
            return (
              <rect
                key={a}
                x={60 + Math.cos(rad) * 12 - 2.5}
                y={68 + Math.sin(rad) * 12 - 2.5}
                width="5"
                height="5"
                rx="1.5"
                fill={BRAND}
              />
            );
          })}
        </Rise>
      </Orbit>
    </Scene>
  );
}

/** The account is on hold, and a person decided that. */
export function FrozenScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <SceneCoin cx={60} cy={54} r={22} tone="brand" glyph="ت" />
      </Rise>
      {/* Paused, not destroyed: the two bars a player knows, over the coin
          rather than through it — lines across it read as damage. */}
      <Rise delay={0.45}>
        <circle cx="86" cy="80" r="16" fill={SURFACE} stroke={INFO} strokeWidth="3" />
        <rect x="81" y="72" width="4" height="16" rx="2" fill={INFO} />
        <rect x="88" y="72" width="4" height="16" rx="2" fill={INFO} />
      </Rise>
    </Scene>
  );
}

/** Add to home screen — the app that is a website until somebody says so. */
export function InstallScene({ size, className, label }: SceneProps) {
  const reduce = useReducedMotion();
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <Phone x={40} y={30} w={40} h={62} />
      </Rise>
      <motion.g
        initial={reduce ? false : { y: -14, opacity: 0 }}
        animate={reduce ? undefined : { y: 0, opacity: 1 }}
        transition={
          reduce
            ? undefined
            : { duration: 0.7, delay: 0.4, repeat: Infinity, repeatDelay: 1.8, ease: "easeOut" }
        }
      >
        <rect x="50" y="44" width="20" height="20" rx="6" fill={BRAND} />
        <path d="M60 50v8M56 54h8" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      </motion.g>
      <Rise delay={0.9}>
        <rect x="52" y="76" width="16" height="3" rx="1.5" fill={LINE} />
      </Rise>
    </Scene>
  );
}

/** Somebody is typing, or the office has not opened it yet. */
export function WaitingScene({ size, className, label }: SceneProps) {
  const reduce = useReducedMotion();
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <path
          d="M30 36h60a7 7 0 0 1 7 7v26a7 7 0 0 1-7 7H52l-14 11V76h-8a7 7 0 0 1-7-7V43a7 7 0 0 1 7-7Z"
          fill={SURFACE}
          stroke={LINE}
          strokeWidth="3"
          strokeLinejoin="round"
        />
      </Rise>
      {[0, 1, 2].map((i) => (
        <motion.circle
          key={i}
          cx={48 + i * 12}
          cy={56}
          r="4.5"
          fill={BRAND}
          initial={reduce ? false : { opacity: 0.25 }}
          animate={reduce ? undefined : { opacity: [0.25, 1, 0.25] }}
          transition={
            reduce ? undefined : { duration: 1.2, repeat: Infinity, delay: 0.3 + i * 0.18 }
          }
        />
      ))}
    </Scene>
  );
}

/** Something the product refused to do, and said why. */
export function BlockedScene({ size, className, label }: SceneProps) {
  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <circle cx="60" cy="58" r="26" fill={SURFACE} stroke={WARN} strokeWidth="3" />
      </Rise>
      <DrawPath d="M42 40l36 36" delay={0.45} width={4} color={WARN} />
    </Scene>
  );
}

/**
 * How to install on an iPhone — the gesture, performed.
 *
 * Safari has no install prompt and never will, so the only thing that helps an
 * iPhone user is being shown where to press. That makes this the first scene in
 * the set with a job beyond recognition: it is an instruction, and it loops
 * because an instruction that plays once is an instruction you missed.
 *
 * Two beats, in the order the hand moves: a tap on the share glyph in Safari's
 * toolbar, then the sheet rising with the "add to home screen" row in it. Under
 * reduced motion both beats are simply *there* — the sheet open, the row shown —
 * because a static instruction still has to teach the same two steps.
 */
export function IosInstallScene({ size, className, label }: SceneProps) {
  const reduce = useReducedMotion();
  const loop = { duration: 4.4, repeat: Infinity, times: [0, 0.12, 0.34, 0.5, 0.86, 1] };

  return (
    <Scene size={size} className={className} label={label}>
      <Rise delay={0.05}>
        <Phone x={34} y={16} w={52} h={88} />
      </Rise>

      {/* Safari's toolbar, and the share glyph in it: a box with an arrow
          leaving through the top. */}
      <Rise delay={0.25}>
        <path d="M38 86h44" stroke={LINE} strokeWidth="2.5" strokeLinecap="round" />
        <path
          d="M55 99v-8a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v8"
          stroke={BRAND}
          strokeWidth="2.6"
          strokeLinecap="round"
          fill="none"
        />
        <path d="M60 94V83" stroke={BRAND} strokeWidth="2.6" strokeLinecap="round" />
        <path
          d="M56.5 86.5 60 83l3.5 3.5"
          stroke={BRAND}
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Rise>

      {/* Beat one: the tap on the share glyph. Rendered either way — under
          reduced motion it rests at full size as a mark saying "press here",
          which is what a still instruction needs. Conditionally *removing* it
          would also be a hydration mismatch the day this scene is ever server
          rendered. */}
      <motion.circle
        cx="60"
        cy="90"
        r="9"
        fill="none"
        stroke={BRAND}
        strokeWidth="2.5"
        initial={reduce ? { opacity: 0.45 } : { opacity: 0, scale: 0.5 }}
        animate={
          reduce
            ? undefined
            : { opacity: [0, 0.9, 0, 0, 0, 0], scale: [0.5, 1.35, 1.6, 1.6, 1.6, 0.5] }
        }
        transition={reduce ? undefined : loop}
        style={{ transformOrigin: "60px 90px" }}
      />

      {/* Beat two: the sheet, with the row you are looking for inside it. */}
      <motion.g
        initial={reduce ? false : { y: 46, opacity: 0 }}
        animate={reduce ? undefined : { y: [46, 46, 0, 0, 0, 46], opacity: [0, 0, 1, 1, 1, 0] }}
        transition={reduce ? undefined : loop}
      >
        <rect
          x="38"
          y="54"
          width="44"
          height="34"
          rx="7"
          fill={SURFACE}
          stroke={LINE}
          strokeWidth="2.5"
        />
        <rect x="55" y="57" width="10" height="2.5" rx="1.25" fill={LINE} />
        <rect x="43" y="65" width="13" height="13" rx="3.5" fill={BRAND} />
        <path d="M49.5 68.5v6M46.5 71.5h6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
        <rect x="60" y="67" width="17" height="2.6" rx="1.3" fill={INK} opacity="0.5" />
        <rect x="60" y="73" width="12" height="2.6" rx="1.3" fill={LINE} />
      </motion.g>

      {/* And the tap that finishes it. */}
      <motion.circle
        cx="49.5"
        cy="71.5"
        r="10"
        fill="none"
        stroke={BRAND}
        strokeWidth="2.5"
        initial={reduce ? { opacity: 0.45 } : { opacity: 0, scale: 0.5 }}
        animate={
          reduce
            ? undefined
            : { opacity: [0, 0, 0, 0.9, 0, 0], scale: [0.5, 0.5, 0.5, 1.4, 1.7, 0.5] }
        }
        transition={reduce ? undefined : loop}
        style={{ transformOrigin: "49.5px 71.5px" }}
      />
    </Scene>
  );
}
