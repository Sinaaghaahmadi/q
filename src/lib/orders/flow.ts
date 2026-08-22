import type { OrderActorRole, OrderState } from "@/lib/supabase/types";

/**
 * The state machine and the role matrix, mirrored from migrations 0004 and
 * 0009 so the UI can offer exactly the actions a caller may take without a
 * round-trip.
 *
 * The database is authoritative — `order_advance` re-checks every one of these
 * and raises if the caller is wrong. This copy exists to decide what to render,
 * never to decide what is permitted. `flow.test.ts` holds the two halves to the
 * same consistency rule the SQL is held to.
 */

export const ALLOWED_TRANSITIONS: Record<OrderState, OrderState[]> = {
  draft: ["submitted", "cancelled", "expired"],
  submitted: ["matching", "cancelled", "expired"],
  matching: ["office_review", "cancelled", "expired"],
  office_review: ["accepted", "info_needed", "cancelled", "expired"],
  accepted: ["awaiting_irt_funding", "cancelled"],
  awaiting_irt_funding: ["irt_funded", "cancelled", "expired"],
  // Directionality (§8.1): the Toman leg funds first and releases last — there
  // is deliberately no path from the foreign states back before irt_funded.
  irt_funded: ["foreign_leg_pending", "disputed", "refunded"],
  foreign_leg_pending: ["foreign_leg_sent", "disputed", "on_hold"],
  foreign_leg_sent: ["recipient_confirmed", "disputed", "on_hold"],
  recipient_confirmed: ["irt_released", "disputed"],
  irt_released: ["completed"],
  completed: [],
  on_hold: ["foreign_leg_pending", "foreign_leg_sent", "disputed", "refunded"],
  info_needed: ["office_review", "cancelled", "expired"],
  disputed: ["on_hold", "refunded", "completed", "sla_breached"],
  cancelled: [],
  refunded: [],
  expired: [],
  sla_breached: [],
};

const ROLE_MAY: Record<OrderActorRole, [OrderState, OrderState][]> = {
  customer: [
    ["draft", "submitted"],
    ["draft", "cancelled"],
    ["submitted", "cancelled"],
    ["matching", "cancelled"],
    ["office_review", "cancelled"],
    ["info_needed", "cancelled"],
    ["accepted", "cancelled"],
    ["awaiting_irt_funding", "cancelled"],
    // The recipient is the only party who can say the money arrived.
    ["foreign_leg_sent", "recipient_confirmed"],
    ["irt_funded", "disputed"],
    ["foreign_leg_pending", "disputed"],
    ["foreign_leg_sent", "disputed"],
    ["recipient_confirmed", "disputed"],
  ],
  office: [
    ["matching", "office_review"],
    ["office_review", "accepted"],
    ["office_review", "info_needed"],
    ["info_needed", "office_review"],
    ["accepted", "awaiting_irt_funding"],
    ["awaiting_irt_funding", "irt_funded"],
    ["irt_funded", "foreign_leg_pending"],
    ["foreign_leg_pending", "foreign_leg_sent"],
    ["foreign_leg_pending", "on_hold"],
    ["foreign_leg_sent", "on_hold"],
    ["on_hold", "foreign_leg_pending"],
    ["on_hold", "foreign_leg_sent"],
    ["recipient_confirmed", "irt_released"],
    ["irt_released", "completed"],
    ["irt_funded", "disputed"],
    ["foreign_leg_pending", "disputed"],
    ["foreign_leg_sent", "disputed"],
  ],
  platform: [
    ["submitted", "matching"],
    ["matching", "office_review"],
    ["office_review", "info_needed"],
    ["info_needed", "office_review"],
    ["irt_funded", "disputed"],
    ["foreign_leg_pending", "disputed"],
    ["foreign_leg_sent", "disputed"],
    ["recipient_confirmed", "disputed"],
    ["foreign_leg_pending", "on_hold"],
    ["foreign_leg_sent", "on_hold"],
    ["on_hold", "foreign_leg_pending"],
    ["on_hold", "foreign_leg_sent"],
    ["on_hold", "disputed"],
    ["disputed", "on_hold"],
    ["disputed", "refunded"],
    ["disputed", "completed"],
    ["disputed", "sla_breached"],
    ["irt_funded", "refunded"],
    ["on_hold", "refunded"],
    ["irt_released", "completed"],
    ["draft", "cancelled"],
    ["submitted", "cancelled"],
    ["matching", "cancelled"],
    ["office_review", "cancelled"],
    ["accepted", "cancelled"],
    ["awaiting_irt_funding", "cancelled"],
    ["info_needed", "cancelled"],
  ],
};

/** The transitions this role may make from this state, in offer order. */
export function actionsFor(role: OrderActorRole | null, from: OrderState): OrderState[] {
  if (!role) return [];
  return ROLE_MAY[role].filter(([f]) => f === from).map(([, t]) => t);
}

export function roleMay(role: OrderActorRole, from: OrderState, to: OrderState): boolean {
  return ROLE_MAY[role].some(([f, t]) => f === from && t === to);
}

/** Every (role, from, to) the matrix permits — for tests and the design page. */
export function allPermitted(): { role: OrderActorRole; from: OrderState; to: OrderState }[] {
  return (Object.keys(ROLE_MAY) as OrderActorRole[]).flatMap((role) =>
    ROLE_MAY[role].map(([from, to]) => ({ role, from, to })),
  );
}

// Nothing leaves these: `allowed_transitions` returns an empty array for each.
const TERMINAL: OrderState[] = ["completed", "cancelled", "refunded", "expired", "sla_breached"];
export function isTerminal(state: OrderState): boolean {
  return TERMINAL.includes(state);
}

/** Badge tone per state — never the only signal; the label always rides along. */
export function stateTone(state: OrderState): "up" | "down" | "warn" | "info" | "neutral" {
  if (state === "completed" || state === "irt_released") return "up";
  if (state === "cancelled" || state === "expired" || state === "sla_breached") return "down";
  if (state === "disputed" || state === "on_hold" || state === "info_needed") return "warn";
  if (state === "draft") return "neutral";
  return "info";
}

/** Actions that must carry a written reason (§18: a decision states its why). */
const NEEDS_REASON: OrderState[] = [
  "cancelled",
  "info_needed",
  "disputed",
  "on_hold",
  "refunded",
  "sla_breached",
];
export function needsReason(to: OrderState): boolean {
  return NEEDS_REASON.includes(to);
}
