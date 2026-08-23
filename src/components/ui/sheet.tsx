"use client";

import { AnimatePresence, motion, useReducedMotion, type PanInfo } from "framer-motion";
import * as React from "react";
import { EASE_OUT, INSTANT, SHEET } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * The bottom sheet: the primary way a detail or a choice arrives on a phone
 * (docs/design-master-prompt.md §5).
 *
 * A dialog interrupts; a sheet extends. Detail about a rate, picking a
 * currency, adding an account — none of those are interruptions, they are the
 * next layer of the thing already on screen, and they should arrive from the
 * edge the thumb is nearest and leave the same way.
 *
 * Dismissal is deliberately generous: drag it down past a quarter of its own
 * height *or* flick it (velocity alone, however short the drag), press Escape,
 * or tap the scrim. A sheet that can only be closed by a small × is a sheet
 * that traps people who opened it by accident.
 *
 * Above `sm` the same content becomes a centred dialog, because a sheet stuck
 * to the bottom of a wide screen is a long way from where the eye is.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  /** Names the sheet for assistive tech. Required — an unnamed sheet is a trap. */
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const panelRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  const descriptionId = React.useId();

  // Escape closes, and the page behind does not scroll while it is open — a
  // sheet that lets the page slide underneath reads as broken on iOS.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  // Focus moves into the sheet so the keyboard follows the eye.
  React.useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  function onDragEnd(_: unknown, info: PanInfo) {
    const height = panelRef.current?.offsetHeight ?? 0;
    const farEnough = info.offset.y > height * 0.25;
    const fastEnough = info.velocity.y > 500;
    if (farEnough || fastEnough) onClose();
  }

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <motion.button
            type="button"
            aria-label={title}
            tabIndex={-1}
            className="absolute inset-0 cursor-default bg-ink-900/40 backdrop-blur-[2px]"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduce ? INSTANT : { duration: 0.2, ease: EASE_OUT }}
            onClick={onClose}
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            tabIndex={-1}
            className={cn(
              "relative flex max-h-[88dvh] w-full flex-col rounded-t-3xl bg-surface shadow-e3 outline-none",
              "sm:max-w-lg sm:rounded-3xl",
              className,
            )}
            initial={reduce ? false : { y: "100%" }}
            animate={{ y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: "100%" }}
            transition={reduce ? INSTANT : SHEET}
            drag={reduce ? false : "y"}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={onDragEnd}
          >
            {/* The grab handle. Decorative — dragging works anywhere on the
                panel, this only advertises that it does. */}
            <div className="flex shrink-0 justify-center pt-3 pb-1" aria-hidden>
              <div className="h-1 w-10 rounded-full bg-ink-300" />
            </div>

            <div className="shrink-0 px-5 pt-2 pb-3">
              <h2 id={titleId} className="text-lg font-semibold">
                {title}
              </h2>
              {description ? (
                <p id={descriptionId} className="mt-1 text-sm leading-relaxed text-ink-600">
                  {description}
                </p>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-2">
              {children}
            </div>

            {footer ? (
              <div className="shrink-0 border-t border-ink-300/50 px-5 py-4 pb-safe">{footer}</div>
            ) : (
              <div className="pb-safe" />
            )}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
