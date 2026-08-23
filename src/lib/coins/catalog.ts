/**
 * Iranian gold coins and bullion, as products a customer can buy.
 *
 * Coins are not a currency and are deliberately not modelled as one. A currency
 * has a corridor, a beneficiary account and a remittance that lands in someone
 * else's bank; a coin has a weight, a mint and a counter you collect it from.
 * Pretending otherwise would mean pushing a coin through a state machine whose
 * middle steps have no meaning for it.
 *
 * Prices come from tgju under the symbols below, all of which were verified
 * live before they were written down. Note the `_buy` variants on the same
 * source (`sekee_buy`, `nim_buy`, …) are *not* used: they last moved in 2018
 * and would quote an eight-year-old price to a customer. The buy and sell sides
 * are derived from the office's own spread, exactly as they are for currencies.
 *
 * Pure data, no JSX, so a Server Component may import it (ADR 0019).
 */

export const COIN_CODES = ["EMAMI", "BAHAR", "NIM", "ROB", "GERAMI", "GERAM18", "MESGHAL"] as const;

export type CoinCode = (typeof COIN_CODES)[number];

export interface CoinMeta {
  code: CoinCode;
  /** tgju's symbol in the live map, verified present and moving. */
  tgjuSymbol: string;
  /**
   * Fine gold content in grams.
   *
   * A full Bahar Azadi is 8.133 g of 900-thousandths gold — 7.32 g fine. The
   * fractions are exact halves and quarters of that by design, so a customer
   * comparing a half coin against two quarters is comparing the same metal.
   * Shown so somebody can work out whether a coin is dear against the gram
   * price sitting two boxes away, which is the single most useful thing this
   * screen can tell them.
   */
  fineGrams: number;
  /** Whether it is a struck coin or a weight of gold. */
  kind: "coin" | "bullion";
  /**
   * Relative size on screen, 0–1. A quarter coin should not be drawn the same
   * size as a full one; the eye reads the hierarchy before the label.
   */
  scale: number;
}

export const COINS: Record<CoinCode, CoinMeta> = {
  EMAMI: { code: "EMAMI", tgjuSymbol: "sekee", fineGrams: 7.32, kind: "coin", scale: 1 },
  BAHAR: { code: "BAHAR", tgjuSymbol: "sekeb", fineGrams: 7.32, kind: "coin", scale: 1 },
  NIM: { code: "NIM", tgjuSymbol: "nim", fineGrams: 3.66, kind: "coin", scale: 0.82 },
  ROB: { code: "ROB", tgjuSymbol: "rob", fineGrams: 1.83, kind: "coin", scale: 0.68 },
  GERAMI: { code: "GERAMI", tgjuSymbol: "gerami", fineGrams: 0.9, kind: "coin", scale: 0.56 },
  GERAM18: {
    code: "GERAM18",
    tgjuSymbol: "geram18",
    // One gram of 18-carat is 0.75 fine by definition.
    fineGrams: 0.75,
    kind: "bullion",
    scale: 0.62,
  },
  MESGHAL: {
    code: "MESGHAL",
    tgjuSymbol: "mesghal",
    // A mesghal is 4.6083 g of 17-carat trade gold: 4.6083 × 0.705 ≈ 3.25 fine.
    fineGrams: 3.25,
    kind: "bullion",
    scale: 0.78,
  },
};

/** One coin's price, in Toman, as the market last saw it. */
export interface CoinQuote {
  code: CoinCode;
  /** Mid price per unit, in Toman. */
  mid: number;
  high24h: number | null;
  low24h: number | null;
  changePct24h: number;
  observedAt: string;
}

export interface CoinSnapshot {
  quotes: Partial<Record<CoinCode, CoinQuote>>;
  fetchedAt: string;
  source: "tgju" | "demo";
  stale: boolean;
}

/**
 * What a customer pays, given the market mid and the office's spread.
 *
 * The same shape as the currency side deliberately: an office that charges 90
 * basis points on dollars and 150 on coins should express both the same way,
 * and a customer comparing the two should not have to learn a second unit.
 */
export function coinBuyPrice(mid: number, spreadBps: number): number {
  return Math.round(mid * (1 + spreadBps / 10_000));
}

export function coinSellPrice(mid: number, spreadBps: number): number {
  return Math.round(mid * (1 - spreadBps / 10_000));
}

/**
 * How much gold a Toman buys, per coin, as a ratio against the gram price.
 *
 * Above 1 means the coin costs more than its metal — which is normal and is
 * the coin's premium (حباب), the number every Iranian buyer actually asks
 * about. Returns null when the gram price is missing rather than guessing,
 * because a wrong premium is worse than none.
 */
export function coinPremiumPct(
  quote: CoinQuote | undefined,
  gramQuote: CoinQuote | undefined,
  code: CoinCode,
): number | null {
  if (!quote || !gramQuote) return null;
  const meta = COINS[code];
  // The gram quote is one gram of 18-carat, i.e. 0.75 g fine.
  const metalValue = (gramQuote.mid / COINS.GERAM18.fineGrams) * meta.fineGrams;
  if (!Number.isFinite(metalValue) || metalValue <= 0) return null;
  return ((quote.mid - metalValue) / metalValue) * 100;
}
