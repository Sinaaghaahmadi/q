"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
}

/**
 * A two-or-three-way choice that looks like a tab strip and is not one.
 *
 * The distinction matters: a tablist promises panels, and every `TabsTrigger`
 * emits `aria-controls` pointing at one. Used as a plain segmented control —
 * where the choice reveals a *field*, not a panel — that attribute dangles and
 * axe rightly flags it (`aria-valid-attr-value`). A radiogroup is what this
 * actually is, so that is what it announces.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  label: string;
  className?: string;
}) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);

  function move(from: number, delta: number) {
    const next = (from + delta + options.length) % options.length;
    const option = options[next];
    if (!option) return;
    onChange(option.value);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "inline-flex h-10 items-center gap-1 rounded-xl bg-ink-300/25 p-1 text-ink-600",
        className,
      )}
    >
      {options.map((option, index) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            // Roving tabindex: the group is one stop, arrows move within it.
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                event.preventDefault();
                move(index, 1);
              } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                event.preventDefault();
                move(index, -1);
              }
            }}
            className={cn(
              "inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg px-3.5 text-sm font-medium transition-colors",
              active && "bg-surface text-ink-900 shadow-e1",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
