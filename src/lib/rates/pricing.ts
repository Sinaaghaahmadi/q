/**
 * Pricing.
 *
 *   customer_rate = base_mid_rate × (1 ± spread_bps/10000)
 *   total_cost    = banded commission on the Toman leg  (see `commission.ts`)
 *   final_amount  = amount converted at customer_rate − total_cost
 *
 * The banded commission is a **ceiling on everything the customer pays**, not
 * one line among several. Whatever the rate markup already took is deducted
 * from it, so the total is the band percentage whatever the office has
 * configured, and "between 5% and 15%, less as you send more" holds at every
 * amount. What is left after the markup splits between the office and the
 * platform at `PLATFORM_SHARE`.
 *
 * Spread therefore defaults to zero: out of the box the rate a customer is
 * quoted is the open-market mid, and the commission is the whole cost. An
 * office that marks the rate up is not charging extra — it is taking part of
 * the same commission through the rate instead of the fee line.
 */

import { commissionOn, PLATFORM_SHARE, type CommissionResult } from "./commission";

export type SpreadLayerKey =
  "platform_floor" | "corridor_default" | "office_markup" | "tier_discount" | "promo";

/**
 * A type alias, not an interface, so it satisfies `Json` when a quote's layers
 * are stored on an order: only anonymous object types get the implicit index
 * signature that check needs (the same trap as ADR 0014).
 */
export type SpreadLayer = {
  key: SpreadLayerKey;
  bps: number;
};

/**
 * The default rate treatment: none.
 *
 * The layers stay in the model because an office can still choose to work
 * through the rate rather than the fee line, and because an order records the
 * layers it was struck under. They are all zero by default so that the quoted
 * rate is the mid a customer can look up themselves.
 */
export const DEFAULT_SPREAD_LAYERS: SpreadLayer[] = [
  { key: "platform_floor", bps: 0 },
  { key: "corridor_default", bps: 0 },
  { key: "office_markup", bps: 0 },
  { key: "tier_discount", bps: 0 },
];

export function totalSpreadBps(layers: SpreadLayer[]): number {
  return layers.reduce((sum, l) => sum + l.bps, 0);
}

export type QuoteDirection = "irt_to_foreign" | "foreign_to_irt";

export interface QuoteInput {
  direction: QuoteDirection;
  /** Amount the customer sends, in the send currency's units. */
  sendAmount: number;
  /** Mid market rate, Toman per 1 unit of the foreign currency. */
  midToman: number;
  layers?: SpreadLayer[];
}

export interface QuoteResult {
  direction: QuoteDirection;
  midToman: number;
  /** Effective customer rate, Toman per unit (ask when buying foreign, bid when selling). */
  customerRateToman: number;
  spreadBps: number;
  layers: SpreadLayer[];
  sendAmount: number;
  /** Fees are always charged on the Toman leg — the Toman leg anchors the flow. */
  platformFeeToman: number;
  officeFeeToman: number;
  /** The banded commission: the ceiling everything else is carved out of. */
  commission: CommissionResult;
  /** Toman the rate markup collected, already inside `commission.toman`. */
  rateMarkupToman: number;
  /** What the recipient gets, in the receive currency's units. */
  receiveAmount: number;
  /** Toman value of the transfer leg before fees — for receipts & savings math. */
  tomanLeg: number;
}

function emptyQuote(input: QuoteInput, layers: SpreadLayer[], spreadBps: number): QuoteResult {
  return {
    direction: input.direction,
    midToman: input.midToman,
    customerRateToman: input.midToman,
    spreadBps,
    layers,
    sendAmount: input.sendAmount,
    platformFeeToman: 0,
    officeFeeToman: 0,
    commission: commissionOn(0),
    rateMarkupToman: 0,
    receiveAmount: 0,
    tomanLeg: 0,
  };
}

/**
 * Split the banded commission into the two columns an order records.
 *
 * The markup the rate already took is money the office has in hand, so it comes
 * out of the office's side first; the platform's share is taken from what is
 * left. When a markup is large enough to swallow the whole commission the
 * platform's share is zero rather than negative — an office that has priced
 * itself to the ceiling has earned it, and the alternative is billing the
 * customer past the ceiling to protect a take-rate.
 */
function split(commissionToman: number, rateMarkupToman: number) {
  const remaining = Math.max(0, commissionToman - rateMarkupToman);
  const platformFeeToman = remaining * PLATFORM_SHARE;
  const officeFeeToman = commissionToman - platformFeeToman;
  return { platformFeeToman, officeFeeToman };
}

export function computeQuote(input: QuoteInput): QuoteResult {
  const layers = input.layers ?? DEFAULT_SPREAD_LAYERS;
  const requestedBps = totalSpreadBps(layers);

  if (input.sendAmount <= 0 || input.midToman <= 0) {
    return emptyQuote(input, layers, requestedBps);
  }

  // The band is decided on the leg valued at mid, never at the marked-up rate:
  // a markup must not be able to push a customer into a more expensive band.
  const tomanLeg =
    input.direction === "irt_to_foreign" ? input.sendAmount : input.sendAmount * input.midToman;
  const commission = commissionOn(tomanLeg);

  /*
   * How much of the band a given spread would collect, and the spread at which
   * it would collect all of it.
   *
   * Selling foreign, the office converts what is left after the fee line, so
   * the markup rides on `tomanLeg − commission`; buying foreign, it rides on
   * the whole leg. Both are solved from one requirement — that the customer's
   * total cost equal the band exactly — rather than assumed, which is what the
   * first version of this got wrong by about a million Toman on a 500M
   * transfer.
   */
  const markupBase =
    input.direction === "irt_to_foreign" ? tomanLeg - commission.toman : tomanLeg;
  const maxFactor = markupBase > 0 ? commission.toman / markupBase : 0;
  // Clamping rather than trusting the configuration is what makes the ceiling
  // absolute: no office markup can charge past the published band.
  const factor = Math.min(requestedBps / 10_000, maxFactor);
  const spreadBps = Math.round(factor * 10_000);
  const rateMarkupToman = factor * markupBase;
  const feeLine = Math.max(0, commission.toman - rateMarkupToman);
  const { platformFeeToman, officeFeeToman } = split(commission.toman, rateMarkupToman);

  const customerRateToman =
    input.direction === "irt_to_foreign"
      ? input.midToman * (1 + factor)
      : input.midToman * (1 - factor);

  const receiveAmount =
    input.direction === "irt_to_foreign"
      ? Math.max(0, tomanLeg - feeLine) / customerRateToman
      : Math.max(0, input.sendAmount * customerRateToman - feeLine);

  return {
    direction: input.direction,
    midToman: input.midToman,
    customerRateToman,
    spreadBps,
    layers,
    sendAmount: input.sendAmount,
    platformFeeToman,
    officeFeeToman,
    commission,
    rateMarkupToman,
    receiveAmount,
    tomanLeg,
  };
}

/**
 * Guardrail: reject quotes deviating beyond the threshold from the reference.
 * Returns the absolute deviation percent.
 */
export function deviationPct(candidate: number, reference: number): number {
  if (reference <= 0) return Infinity;
  return Math.abs((candidate - reference) / reference) * 100;
}
