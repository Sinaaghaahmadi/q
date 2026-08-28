"use client";

import * as React from "react";
import { MatchingScene, SuccessScene } from "@/components/brand/scenes/core";
import { MoreInfoScene, VerifiedScene } from "@/components/brand/scenes/identity";
import {
  AwaitingDepositScene,
  DepositHeldScene,
  DisputeScene,
  ForeignLegSentScene,
  OfficeReviewScene,
  OrderCancelledScene,
  QuoteScene,
  RateExpiredScene,
  RecipientPaidScene,
  RefundScene,
} from "@/components/brand/scenes/money";
import { SettlementScene } from "@/components/brand/scenes/staff";
import { BlockedScene, FrozenScene, WaitingScene } from "@/components/brand/scenes/states";
import type { OrderState } from "@/lib/supabase/types";

/**
 * One drawing per state of the machine (§8.1).
 *
 * A remittance is eighteen states long and a person can see none of them. The
 * sentence under this picture already says which one it is; the picture says
 * it first, from across a room, in a language that survives a customer who
 * reads slowly or not at all — which on this product is not a rare case.
 *
 * The map is exhaustive over `OrderState` on purpose: a state added to the
 * machine without a drawing fails the build here rather than rendering a blank
 * card in front of somebody whose money is in the middle of it.
 */
const SCENES: Record<OrderState, React.ComponentType<{ size?: number; label?: string }>> = {
  draft: QuoteScene,
  submitted: WaitingScene,
  matching: MatchingScene,
  office_review: OfficeReviewScene,
  accepted: VerifiedScene,
  awaiting_irt_funding: AwaitingDepositScene,
  irt_funded: DepositHeldScene,
  foreign_leg_pending: WaitingScene,
  foreign_leg_sent: ForeignLegSentScene,
  recipient_confirmed: RecipientPaidScene,
  irt_released: SettlementScene,
  completed: SuccessScene,
  on_hold: FrozenScene,
  info_needed: MoreInfoScene,
  disputed: DisputeScene,
  cancelled: OrderCancelledScene,
  refunded: RefundScene,
  expired: RateExpiredScene,
  sla_breached: BlockedScene,
};

export function OrderStateScene({
  state,
  size = 96,
  label,
}: {
  state: OrderState;
  size?: number;
  /** The state's own sentence, so a screen reader gets one description. */
  label?: string;
}) {
  const Component = SCENES[state];
  if (!Component) return null;
  return <Component size={size} label={label} />;
}
