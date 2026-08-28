import type { OrderState } from "@/lib/supabase/types";

/**
 * The exchange office's work, expressed the way the person behind the counter
 * thinks about it.
 *
 * The machine in §8.1 has nineteen states and the office may legally drive nine
 * transitions. That is the right model for the ledger and the wrong model for a
 * صراف who wants to know what to press. Most of those hops are bookkeeping
 * nobody performs — `accepted → awaiting_irt_funding` is not an act, it is the
 * consequence of accepting.
 *
 * So a whole transfer is four presses: I'll take it · the Toman arrived · I've
 * sent the currency · settled. `office_step` walks each chain in one
 * transaction through `order_advance`, so every hop is still checked, still
 * audited, and still appears on the customer's timeline separately. Nothing is
 * hidden — only the *asking* is collapsed.
 *
 * The fifth act is the customer's: only the recipient can say the money arrived
 * (§8.1), so between "sent" and "settled" the office waits, and the panel says
 * so instead of offering a button that would be refused.
 */
export type OfficeStep = "claim" | "accept" | "money_in" | "sent" | "settle";

/** Things that go wrong, kept off the main path so it stays one button wide. */
export type OfficeAside = "hold" | "ask" | "resume";

export type OfficeAction = {
  step: OfficeStep;
  /** i18n key under `officePanel.act` — the sentence on the button. */
  key: OfficeStep;
  /** Which of the four beats of a transfer this is, for the progress dots. */
  beat: 1 | 2 | 3 | 4;
};

/** What, if anything, this office does next on an order in this state. */
export function nextAction(state: OrderState): OfficeAction | null {
  switch (state) {
    case "matching":
      return { step: "claim", key: "claim", beat: 1 };
    case "office_review":
    case "info_needed":
      return { step: "accept", key: "accept", beat: 1 };
    case "accepted":
    case "awaiting_irt_funding":
      return { step: "money_in", key: "money_in", beat: 2 };
    case "irt_funded":
    case "foreign_leg_pending":
    case "on_hold":
      return { step: "sent", key: "sent", beat: 3 };
    case "recipient_confirmed":
    case "irt_released":
      return { step: "settle", key: "settle", beat: 4 };
    default:
      return null;
  }
}

/**
 * Why there is no button. `null` means the order is finished; anything else is
 * an i18n key under `officePanel.waiting` explaining who is being waited on —
 * "nothing to do" is never left to be inferred from an absent control.
 */
export function waitingOn(state: OrderState): string | null {
  switch (state) {
    case "foreign_leg_sent":
      return "recipient";
    case "draft":
    case "submitted":
      return "customer";
    case "disputed":
      return "platform";
    default:
      return null;
  }
}

/** Which of the four beats an order has reached, for the progress dots. */
export function beatOf(state: OrderState): number {
  const order: OrderState[] = [
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
  const index = order.indexOf(state);
  if (index < 0) return 0;
  if (index <= 1) return 1;
  if (index <= 3) return 2;
  if (index <= 6) return 3;
  return 4;
}

/** Terminal for the office: nothing it does moves this order again. */
export function isDone(state: OrderState): boolean {
  return ["completed", "cancelled", "refunded", "expired", "sla_breached"].includes(state);
}
