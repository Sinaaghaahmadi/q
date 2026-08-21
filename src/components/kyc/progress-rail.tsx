"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import * as React from "react";
import { EASE_IN } from "@/components/brand/scene";
import { cn } from "@/lib/utils";

/**
 * The wizard's progress rail (§6: "each its own screen with an animated
 * illustration and a progress rail"). Completed nodes collapse to a filled
 * check; the connector fills along the reading direction, so RTL reads
 * right-to-left without any mirroring hack.
 */
export function ProgressRail({
  steps,
  current,
}: {
  steps: { key: string; label: string }[];
  current: number;
}) {
  const reduce = useReducedMotion();

  return (
    <ol className="flex items-center gap-1.5" aria-label="progress">
      {steps.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={step.key} className="flex flex-1 items-center gap-1.5">
            <span className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                  done && "border-brand-600 bg-brand-600 text-white",
                  active && "border-brand-600 bg-brand-50 text-brand-700 dark:text-brand-600",
                  !done && !active && "border-ink-300 text-ink-600",
                )}
                aria-current={active ? "step" : undefined}
              >
                {done ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span
                className={cn(
                  "hidden text-[0.6875rem] font-medium sm:block",
                  active ? "text-ink-900" : "text-ink-600",
                )}
              >
                {step.label}
              </span>
            </span>
            {i < steps.length - 1 ? (
              <span className="relative mb-5 h-0.5 flex-1 overflow-hidden rounded-full bg-ink-300/60">
                <motion.span
                  className="absolute inset-y-0 start-0 bg-brand-600"
                  initial={reduce ? false : { width: 0 }}
                  animate={{ width: done ? "100%" : "0%" }}
                  transition={reduce ? { duration: 0 } : { duration: 0.45, ease: EASE_IN }}
                />
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
