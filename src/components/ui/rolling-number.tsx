"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import * as React from "react";
import { cn } from "@/lib/utils";

interface RollingNumberProps {
  /** Pre-formatted, localized value (digits, separators, symbols). */
  value: string;
  className?: string;
  /** Flash tint applied when the value last moved up/down (§13 rate tick). */
  direction?: "up" | "down" | null;
}

/**
 * Odometer-style digit roll (§13): only changed characters animate; the flash
 * lands on the changed digits, not the whole figure. Transform/opacity only.
 */
export function RollingNumber({ value, className, direction }: RollingNumberProps) {
  const reduce = useReducedMotion();
  const chars = React.useMemo(() => Array.from(value), [value]);
  const prevRef = React.useRef<string[]>(chars);
  const prev = prevRef.current;
  React.useEffect(() => {
    prevRef.current = chars;
  }, [chars]);

  if (reduce) {
    return (
      <span className={cn("num", className)} dir="ltr">
        {value}
      </span>
    );
  }

  return (
    <span className={cn("num inline-flex overflow-hidden", className)} dir="ltr" aria-label={value}>
      {chars.map((ch, i) => {
        const changed = prev[i] !== ch;
        return (
          <span key={`${i}-${chars.length}`} className="relative inline-block" aria-hidden>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={ch}
                initial={{ y: "0.8em", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: "-0.8em", opacity: 0 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  "inline-block",
                  changed && direction === "up" && "text-up",
                  changed && direction === "down" && "text-down",
                )}
                style={
                  changed ? { transitionProperty: "color", transitionDuration: "400ms" } : undefined
                }
              >
                {ch}
              </motion.span>
            </AnimatePresence>
          </span>
        );
      })}
    </span>
  );
}
