"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import * as React from "react";
import { EASE_IN, INSTANT } from "@/lib/motion";

/**
 * Seventeen people, no shared office, one thing being built.
 *
 * Drawn rather than photographed or pulled from a map library: a real
 * projection would cost a dependency and put borders on a page about people,
 * and borders are exactly what this team does not have. So the continents are
 * a loose dotted field in brand tint — recognisable as the world, specific
 * about nothing — with the members as nodes on it and arcs running between
 * them.
 *
 * The arcs draw themselves in sequence and then keep a slow pulse travelling
 * along them, which is the point: the connection is the subject, not the
 * locations. Under reduced motion everything is simply already drawn.
 *
 * Coordinates are hand-placed on a 720×360 field, roughly equirectangular —
 * close enough to read as Earth, and no claim to be a map.
 */
type Node = { x: number; y: number; key: string };

/** Where the team actually is. Nine markers for seventeen people. */
const NODES: Node[] = [
  { x: 452, y: 150, key: "tehran" },
  { x: 372, y: 118, key: "berlin" },
  { x: 340, y: 122, key: "london" },
  { x: 398, y: 108, key: "stockholm" },
  { x: 418, y: 168, key: "dubai" },
  { x: 176, y: 148, key: "toronto" },
  { x: 118, y: 168, key: "vancouver" },
  { x: 560, y: 196, key: "kualaLumpur" },
  { x: 622, y: 268, key: "sydney" },
];

/** Every arc starts in Tehran: the work is remote, the reason is not. */
const HUB = 0;

export function TeamMap() {
  const t = useTranslations("about.map");
  const reduce = useReducedMotion();

  const hub = NODES[HUB]!;
  const arcs = NODES.filter((_, i) => i !== HUB).map((node) => {
    // Lift the control point above the chord so arcs bow outward like routes on
    // a globe rather than sagging like cables.
    const midX = (hub.x + node.x) / 2;
    const midY = (hub.y + node.y) / 2 - Math.abs(hub.x - node.x) * 0.22 - 18;
    return { node, d: `M ${hub.x} ${hub.y} Q ${midX} ${midY} ${node.x} ${node.y}` };
  });

  return (
    <figure
      className="overflow-hidden rounded-3xl bg-brand-50/60 p-4 sm:p-6"
      // The map is a single composed picture; mirroring it in RTL would put the
      // Americas in Asia. Direction is pinned here, unlike the caption below.
      dir="ltr"
    >
      <svg viewBox="0 0 720 360" role="img" aria-label={t("alt")} className="h-auto w-full">
        <defs>
          <radialGradient id="team-glow">
            <stop offset="0%" stopColor="var(--brand-600)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--brand-600)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Landmass: a dotted field, deliberately imprecise. */}
        <g fill="var(--brand-600)" opacity="0.16">
          {LAND.map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r="2.6" />
          ))}
        </g>

        {arcs.map(({ node, d }, i) => (
          <g key={node.key}>
            <motion.path
              d={d}
              fill="none"
              stroke="var(--brand-600)"
              strokeWidth="1.6"
              strokeOpacity="0.55"
              strokeLinecap="round"
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={reduce ? INSTANT : { duration: 0.9, delay: 0.15 * i, ease: EASE_IN }}
            />
            {/* A parcel travelling the route. Staggered so the field never
                pulses in unison, which would read as a loading state. */}
            {reduce ? null : (
              <motion.circle
                r="3.2"
                fill="var(--brand-600)"
                initial={{ offsetDistance: "0%", opacity: 0 }}
                animate={{ offsetDistance: "100%", opacity: [0, 1, 1, 0] }}
                transition={{
                  duration: 2.6,
                  delay: 1.2 + 0.35 * i,
                  repeat: Infinity,
                  repeatDelay: 1.8,
                  ease: "linear",
                }}
                style={{ offsetPath: `path("${d}")` }}
              />
            )}
          </g>
        ))}

        {NODES.map((node, i) => (
          <g key={node.key}>
            <circle cx={node.x} cy={node.y} r="26" fill="url(#team-glow)" />
            <motion.circle
              cx={node.x}
              cy={node.y}
              r={i === HUB ? 7 : 5}
              fill="var(--brand-600)"
              stroke="var(--surface)"
              strokeWidth="2"
              initial={reduce ? false : { scale: 0 }}
              animate={{ scale: 1 }}
              transition={reduce ? INSTANT : { ...PIN, delay: 0.1 * i }}
              style={{ transformOrigin: `${node.x}px ${node.y}px` }}
            />
          </g>
        ))}
      </svg>
      <figcaption className="mt-3 text-center text-xs text-ink-600">{t("caption")}</figcaption>
    </figure>
  );
}

const PIN = { type: "spring" as const, visualDuration: 0.4, bounce: 0.35 };

/**
 * The dotted landmass. Hand-plotted on the same 720×360 field — enough to read
 * as continents at a glance and nothing more; this is decoration behind the
 * arcs, not geography anyone should navigate by.
 */
const LAND: [number, number][] = [
  // North America
  [96, 96],
  [112, 90],
  [128, 96],
  [144, 92],
  [160, 100],
  [104, 112],
  [120, 110],
  [136, 108],
  [152, 114],
  [168, 118],
  [112, 128],
  [128, 126],
  [144, 130],
  [160, 134],
  [176, 140],
  [124, 144],
  [140, 148],
  [156, 152],
  [172, 156],
  [148, 166],
  [164, 170],
  // Central + South America
  [172, 186],
  [180, 198],
  [188, 210],
  [196, 222],
  [204, 234],
  [212, 246],
  [200, 252],
  [188, 244],
  [196, 262],
  [204, 272],
  [212, 258],
  [220, 244],
  [228, 232],
  // Europe
  [332, 100],
  [348, 96],
  [364, 100],
  [380, 96],
  [396, 92],
  [340, 112],
  [356, 110],
  [372, 114],
  [388, 110],
  [404, 106],
  [348, 124],
  [364, 126],
  [380, 122],
  [396, 120],
  // Africa
  [356, 152],
  [372, 150],
  [388, 156],
  [364, 168],
  [380, 170],
  [396, 166],
  [372, 184],
  [388, 186],
  [404, 182],
  [380, 200],
  [396, 202],
  [388, 216],
  [376, 228],
  // Middle East + Asia
  [412, 136],
  [428, 132],
  [444, 138],
  [460, 134],
  [476, 140],
  [492, 136],
  [508, 142],
  [524, 138],
  [540, 144],
  [556, 150],
  [420, 152],
  [436, 156],
  [452, 152],
  [468, 158],
  [484, 154],
  [500, 160],
  [516, 156],
  [532, 162],
  [548, 168],
  [564, 174],
  [500, 176],
  [516, 180],
  [532, 186],
  [548, 192],
  [564, 198],
  [580, 192],
  // Australia
  [596, 246],
  [612, 242],
  [628, 248],
  [644, 244],
  [604, 258],
  [620, 262],
  [636, 258],
  [612, 272],
  [628, 274],
];
