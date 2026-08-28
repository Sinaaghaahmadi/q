"use client";

import * as React from "react";
import { FOREIGN_CODES, type CurrencyCode } from "@/lib/rates/catalog";

const ORDER_KEY = "asaex.rates.order";

/**
 * The order the viewer put their currencies in.
 *
 * Stored per browser rather than per account on purpose. This is a preference
 * about a screen, not a fact about a person: it needs no sign-in to be useful,
 * it should not travel to a shared terminal at the office, and losing it costs
 * one drag. Favourites already work the same way.
 *
 * The stored list is treated as a *hint*, never as the truth. It is filtered
 * against the live catalogue and then the catalogue's own remainder is appended,
 * so a currency added after someone last dragged still appears — at the bottom,
 * but present. A stored order that has gone stale can therefore never hide a
 * rate, which is the only failure mode here that would actually matter.
 */
export function useRateOrder() {
  const [order, setOrder] = React.useState<CurrencyCode[]>([...FOREIGN_CODES]);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(ORDER_KEY);
      if (!raw) return;
      const stored = JSON.parse(raw) as unknown;
      if (!Array.isArray(stored)) return;
      setOrder(reconcile(stored));
    } catch {
      // A per-viewer convenience: a private window or blocked storage just
      // means the catalogue's own order, which is a perfectly good order.
    }
  }, []);

  const persist = React.useCallback((next: CurrencyCode[]) => {
    setOrder(next);
    try {
      localStorage.setItem(ORDER_KEY, JSON.stringify(next));
    } catch {
      // ignore — the move still works for this session
    }
  }, []);

  /** Move one currency to a new index, shifting the rest around it. */
  const move = React.useCallback((code: CurrencyCode, to: number) => {
    setOrder((prev) => {
      const from = prev.indexOf(code);
      if (from < 0) return prev;
      const target = Math.max(0, Math.min(prev.length - 1, to));
      if (from === target) return prev;
      const next = [...prev];
      next.splice(from, 1);
      next.splice(target, 0, code);
      try {
        localStorage.setItem(ORDER_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const reset = React.useCallback(() => persist([...FOREIGN_CODES]), [persist]);

  return { order, move, reset };
}

/** Keep what the catalogue still knows, then append whatever it has gained. */
function reconcile(stored: unknown[]): CurrencyCode[] {
  const known = new Set<string>(FOREIGN_CODES);
  const kept = stored.filter((c): c is CurrencyCode => typeof c === "string" && known.has(c));
  const seen = new Set(kept);
  return [...kept, ...FOREIGN_CODES.filter((c) => !seen.has(c))];
}
