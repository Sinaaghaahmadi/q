"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, CircleAlert } from "lucide-react";
import * as React from "react";
import { INSTANT, SHEET, TOAST_MS } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Short confirmations — copied, saved, sent (§5).
 *
 * Deliberately not a notification system: no queue depth to reason about, no
 * actions inside, no dismissal affordance. A toast says a thing that already
 * happened and then leaves. Anything a person must *act* on is not a toast; it
 * belongs on the page where the consequence lives.
 *
 * The live region is `polite` and permanent, so a screen reader announces the
 * text when it appears rather than only noticing it if focus happens to land
 * there.
 */
type Toast = { id: number; text: string; tone: "ok" | "bad" };

const ToastContext = React.createContext<((text: string, tone?: "ok" | "bad") => void) | null>(
  null,
);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const reduce = useReducedMotion();
  const nextId = React.useRef(0);

  const show = React.useCallback((text: string, tone: "ok" | "bad" = "ok") => {
    const id = nextId.current++;
    setToasts((current) => [...current, { id, text, tone }]);
    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, TOAST_MS);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 px-4 pb-24 md:pb-8"
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              initial={reduce ? false : { opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
              transition={reduce ? INSTANT : SHEET}
              className={cn(
                "flex max-w-sm items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium shadow-e2",
                toast.tone === "ok" ? "bg-ink-900 text-canvas" : "bg-danger-solid text-white",
              )}
            >
              {toast.tone === "ok" ? (
                <Check className="size-4 shrink-0" aria-hidden />
              ) : (
                <CircleAlert className="size-4 shrink-0" aria-hidden />
              )}
              {toast.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

/**
 * `toast("کپی شد")` from any client component under the provider.
 *
 * Returns a no-op outside the provider rather than throwing: a missing toast is
 * a missing nicety, and it should never be the reason a page fails to render.
 */
export function useToast() {
  const show = React.useContext(ToastContext);
  return show ?? noop;
}

function noop() {}
