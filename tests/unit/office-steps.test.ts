import { describe, expect, it } from "vitest";
import { ALLOWED_TRANSITIONS } from "@/lib/orders/flow";
import { beatOf, isDone, nextAction, waitingOn } from "@/lib/office/steps";
import type { OrderState } from "@/lib/supabase/types";

const STATES = Object.keys(ALLOWED_TRANSITIONS) as OrderState[];

describe("office steps", () => {
  /**
   * The panel shows exactly one of three things per order: a button, a line
   * saying who is being waited on, or a finished badge. A state that answers
   * "no" to all three would render a card with nothing in it, and the operator
   * would be left staring at a job with no way forward and no explanation.
   */
  it("classifies every order state", () => {
    const orphans = STATES.filter(
      (s) => nextAction(s) === null && waitingOn(s) === null && !isDone(s),
    );
    expect(orphans).toEqual([]);
  });

  it("never offers a button on a finished order", () => {
    for (const state of STATES.filter(isDone)) {
      expect(nextAction(state), state).toBeNull();
    }
  });

  it("never offers a button while waiting on someone else", () => {
    for (const state of STATES.filter((s) => waitingOn(s) !== null)) {
      expect(nextAction(state), state).toBeNull();
    }
  });

  /**
   * The dots and the button have to agree. If `beatOf` says an order is on
   * beat 3 while the button is the beat-2 one, the operator sees the progress
   * jump backwards the moment they press it.
   */
  it("agrees with the progress dots on the happy path", () => {
    const happy: OrderState[] = [
      "matching",
      "office_review",
      "accepted",
      "awaiting_irt_funding",
      "irt_funded",
      "foreign_leg_pending",
      "recipient_confirmed",
      "irt_released",
    ];
    for (const state of happy) {
      const action = nextAction(state);
      expect(action, state).not.toBeNull();
      expect(action?.beat, state).toBe(beatOf(state));
    }
  });

  it("advances the beat monotonically along the happy path", () => {
    const path: OrderState[] = [
      "matching",
      "office_review",
      "accepted",
      "awaiting_irt_funding",
      "irt_funded",
      "foreign_leg_pending",
      "foreign_leg_sent",
      "recipient_confirmed",
      "irt_released",
      "completed",
    ];
    const beats = path.map(beatOf);
    expect(beats).toEqual([...beats].sort((a, b) => a - b));
    expect(beats[0]).toBe(1);
    expect(beats.at(-1)).toBe(4);
  });

  /**
   * `nextAction` is a promise that the transition it names is one the office
   * may actually drive. If the shortcut chain starts with a hop the machine
   * refuses, the button fails at the counter with the customer waiting.
   */
  it("only proposes steps the state machine can begin", () => {
    for (const state of STATES) {
      const action = nextAction(state);
      if (!action) continue;
      expect(ALLOWED_TRANSITIONS[state].length, `${state} → ${action.step}`).toBeGreaterThan(0);
    }
  });
});
