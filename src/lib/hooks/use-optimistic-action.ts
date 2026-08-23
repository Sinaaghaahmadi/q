"use client";

import * as React from "react";

/**
 * Principle 1 of the design brief: the UI moves before the network does.
 *
 * The pattern this replaces is everywhere in this codebase — set `busy`,
 * `await` the call, `router.refresh()`, and until the round trip lands the
 * person is looking at a spinner wondering whether their tap registered. On a
 * connection into Iran that round trip is not 80ms.
 *
 * So: apply the change locally the instant it is asked for, send it, and if the
 * server disagrees put the old value back and say so. The lie is bounded — it
 * lasts exactly as long as the request, and it is always corrected.
 *
 * Two rules this enforces, both worth stating plainly:
 *
 *  - **Never be optimistic about money.** Use this for a saved account, a read
 *    receipt, a sent message, a toggled preference. Never for "the transfer
 *    went through" — an order's state comes from the state machine, and showing
 *    a settlement that has not happened is not a flourish, it is a lie about
 *    someone's money.
 *  - **A failure restores the server's value, not a guess.** The override is
 *    simply dropped, so what renders next is whatever the server last said.
 */
export type OptimisticAction<T> = {
  /** What to render: the optimistic value while in flight, the truth otherwise. */
  value: T;
  /** A request is in flight. Show a quiet marker, not a blocking spinner. */
  pending: boolean;
  /** The last failure, cleared on the next attempt. */
  error: string | null;
  /**
   * Show `next` immediately, run `commit`, roll back if it throws or resolves
   * to a non-empty string. Resolves true when the server agreed.
   */
  run: (next: T, commit: () => Promise<string | null | void>) => Promise<boolean>;
  clearError: () => void;
};

export function useOptimisticAction<T>(serverValue: T): OptimisticAction<T> {
  const [override, setOverride] = React.useState<{ value: T } | null>(null);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // On success the override is kept — it already matches what the server now
  // holds, and dropping it before the refresh lands would flash the old value.
  // This clears it once the new server value actually arrives, which is the
  // only moment the two are known to agree.
  const lastServerValue = React.useRef(serverValue);
  if (lastServerValue.current !== serverValue) {
    lastServerValue.current = serverValue;
    if (override !== null) setOverride(null);
  }

  const run = React.useCallback(async (next: T, commit: () => Promise<string | null | void>) => {
    setOverride({ value: next });
    setPending(true);
    setError(null);
    try {
      const failure = await commit();
      if (typeof failure === "string" && failure.length > 0) {
        setError(failure);
        setOverride(null);
        return false;
      }
      return true;
    } catch {
      setError("network");
      setOverride(null);
      return false;
    } finally {
      setPending(false);
    }
  }, []);

  return {
    value: override ? override.value : serverValue,
    pending,
    error,
    run,
    clearError: React.useCallback(() => setError(null), []),
  };
}
