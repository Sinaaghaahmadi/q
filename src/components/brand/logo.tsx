"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useLocale } from "next-intl";
import * as React from "react";
import { LOGO_STROKES, LOGO_VIEWBOX } from "@/lib/brand/logo-paths";
import { cn } from "@/lib/utils";

interface LogoMarkProps {
  size?: number;
  className?: string;
  /** App-launch draw animation (§13): strokes draw in over ~700ms, once. */
  animated?: boolean;
}

export function LogoMark({ size = 28, className, animated = false }: LogoMarkProps) {
  const reduce = useReducedMotion();
  const draw = animated && !reduce;

  return (
    <svg
      width={size}
      height={size}
      viewBox={LOGO_VIEWBOX}
      fill="none"
      aria-hidden
      className={cn("shrink-0", className)}
    >
      {LOGO_STROKES.map((s, i) => (
        <motion.path
          key={i}
          d={s.d}
          stroke="currentColor"
          strokeWidth={s.width}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={draw ? { pathLength: 0, opacity: 0 } : false}
          animate={draw ? { pathLength: 1, opacity: 1 } : undefined}
          transition={
            draw ? { duration: 0.45, delay: 0.08 * i, ease: [0.22, 1, 0.36, 1] } : undefined
          }
        />
      ))}
    </svg>
  );
}

interface LogoLockupProps {
  size?: number;
  className?: string;
  animated?: boolean;
}

/**
 * Wordmark lockup (§2.2). In the fa lockup the mark sits on the right — the
 * RTL flex order does this by construction, no mirroring.
 */
export function LogoLockup({ size = 28, className, animated }: LogoLockupProps) {
  const locale = useLocale();
  return (
    <span className={cn("inline-flex items-center gap-2 text-ink-900", className)}>
      <LogoMark size={size} animated={animated} className="text-brand-600" />
      {locale === "fa" ? (
        <span className="text-lg leading-none font-bold">صرافی آسا</span>
      ) : (
        <span className="text-lg leading-none font-semibold tracking-tight">Asaex</span>
      )}
    </span>
  );
}
