/**
 * Pricing (§7.2):
 *   customer_rate = base_mid_rate × (1 ± spread_bps/10000)
 *   final_amount  = amount × customer_rate − platform_fee − office_fee
 *
 * Spread is layered and every layer stays visible (Wise-style transparency).
 * Values below are the Phase-1 demo configuration; in later phases they come
 * from `office_rate_config` + platform settings and are inspectable in the
 * admin quote inspector.
 */

export type SpreadLayerKey =
  "platform_floor" | "corridor_default" | "office_markup" | "tier_discount" | "promo";

export interface SpreadLayer {
  key: SpreadLayerKey;
  bps: number;
}

export const DEMO_SPREAD_LAYERS: SpreadLayer[] = [
  { key: "platform_floor", bps: 20 },
  { key: "corridor_default", bps: 45 },
  { key: "office_markup", bps: 25 },
  { key: "tier_discount", bps: 0 },
];

/** Platform fee: 0.25% of the Toman leg, min 150,000 Toman (demo config). */
export const DEMO_PLATFORM_FEE = { pct: 0.25, minToman: 150_000 };
/** Office fee: 0.15% of the Toman leg, min 100,000 Toman (demo config). */
export const DEMO_OFFICE_FEE = { pct: 0.15, minToman: 100_000 };

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
  /** Fees are always charged on the Toman leg (§8: the Toman leg anchors the flow). */
  platformFeeToman: number;
  officeFeeToman: number;
  /** What the recipient gets, in the receive currency's units. */
  receiveAmount: number;
  /** Toman value of the transfer leg before fees — for receipts & savings math. */
  tomanLeg: number;
}

export function computeQuote(input: QuoteInput): QuoteResult {
  const layers = input.layers ?? DEMO_SPREAD_LAYERS;
  const spreadBps = totalSpreadBps(layers);
  const factor = spreadBps / 10_000;

  if (input.sendAmount <= 0 || input.midToman <= 0) {
    return {
      direction: input.direction,
      midToman: input.midToman,
      customerRateToman: input.midToman,
      spreadBps,
      layers,
      sendAmount: input.sendAmount,
      platformFeeToman: 0,
      officeFeeToman: 0,
      receiveAmount: 0,
      tomanLeg: 0,
    };
  }

  if (input.direction === "irt_to_foreign") {
    // Customer pays Toman, recipient gets foreign: platform sells foreign at ask.
    const ask = input.midToman * (1 + factor);
    const tomanLeg = input.sendAmount;
    const platformFeeToman = Math.max(
      (tomanLeg * DEMO_PLATFORM_FEE.pct) / 100,
      DEMO_PLATFORM_FEE.minToman,
    );
    const officeFeeToman = Math.max(
      (tomanLeg * DEMO_OFFICE_FEE.pct) / 100,
      DEMO_OFFICE_FEE.minToman,
    );
    const net = Math.max(0, tomanLeg - platformFeeToman - officeFeeToman);
    return {
      direction: input.direction,
      midToman: input.midToman,
      customerRateToman: ask,
      spreadBps,
      layers,
      sendAmount: input.sendAmount,
      platformFeeToman,
      officeFeeToman,
      receiveAmount: net / ask,
      tomanLeg,
    };
  }

  // Customer sends foreign, recipient gets Toman: platform buys foreign at bid.
  const bid = input.midToman * (1 - factor);
  const tomanLeg = input.sendAmount * bid;
  const platformFeeToman = Math.max(
    (tomanLeg * DEMO_PLATFORM_FEE.pct) / 100,
    DEMO_PLATFORM_FEE.minToman,
  );
  const officeFeeToman = Math.max((tomanLeg * DEMO_OFFICE_FEE.pct) / 100, DEMO_OFFICE_FEE.minToman);
  return {
    direction: input.direction,
    midToman: input.midToman,
    customerRateToman: bid,
    spreadBps,
    layers,
    sendAmount: input.sendAmount,
    platformFeeToman,
    officeFeeToman,
    receiveAmount: Math.max(0, tomanLeg - platformFeeToman - officeFeeToman),
    tomanLeg,
  };
}

/**
 * Guardrail (§7.2): reject quotes deviating beyond the threshold from the
 * reference. Returns the absolute deviation percent.
 */
export function deviationPct(candidate: number, reference: number): number {
  if (reference <= 0) return Infinity;
  return Math.abs((candidate - reference) / reference) * 100;
}
