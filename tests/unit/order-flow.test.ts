import { describe, expect, it } from "vitest";
import { ALLOWED_TRANSITIONS, actionsFor, allPermitted, isTerminal } from "@/lib/orders/flow";
import type { OrderState } from "@/lib/supabase/types";

describe("order flow", () => {
  it("never permits a role a transition the machine forbids", () => {
    // The same assertion supabase/tests/rls.sql makes against the database. If
    // these two mirrors drift, the UI offers a button the RPC will reject.
    const illegal = allPermitted().filter(
      ({ from, to }) => !ALLOWED_TRANSITIONS[from].includes(to),
    );
    expect(illegal).toEqual([]);
  });

  it("keeps the Toman leg funding first and releasing last (§8.1)", () => {
    // Once funded there is no way back to an unfunded state.
    const unfunded: OrderState[] = ["draft", "submitted", "matching", "accepted"];
    for (const state of ["irt_funded", "foreign_leg_pending", "foreign_leg_sent"] as const) {
      expect(ALLOWED_TRANSITIONS[state].filter((s) => unfunded.includes(s))).toEqual([]);
    }
    // And releasing is only reachable once the recipient has confirmed.
    const toReleased = (Object.keys(ALLOWED_TRANSITIONS) as OrderState[]).filter((s) =>
      ALLOWED_TRANSITIONS[s].includes("irt_released"),
    );
    expect(toReleased).toEqual(["recipient_confirmed"]);
  });

  it("lets only the customer confirm receipt", () => {
    expect(actionsFor("customer", "foreign_leg_sent")).toContain("recipient_confirmed");
    expect(actionsFor("office", "foreign_leg_sent")).not.toContain("recipient_confirmed");
    expect(actionsFor("platform", "foreign_leg_sent")).not.toContain("recipient_confirmed");
  });

  it("never offers a funded order a cancellation", () => {
    for (const role of ["customer", "office", "platform"] as const) {
      expect(actionsFor(role, "irt_funded")).not.toContain("cancelled");
      expect(actionsFor(role, "foreign_leg_sent")).not.toContain("cancelled");
    }
  });

  it("offers nothing at all once an order is terminal", () => {
    for (const state of ["completed", "cancelled", "refunded", "expired"] as const) {
      expect(isTerminal(state)).toBe(true);
      for (const role of ["customer", "office", "platform"] as const) {
        expect(actionsFor(role, state)).toEqual([]);
      }
    }
  });

  it("offers nothing to someone who is not a party", () => {
    expect(actionsFor(null, "matching")).toEqual([]);
  });
});
