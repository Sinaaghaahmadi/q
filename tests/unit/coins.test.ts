import { describe, expect, it } from "vitest";
import {
  COINS,
  COIN_CODES,
  coinBuyPrice,
  coinPremiumPct,
  coinSellPrice,
  type CoinQuote,
} from "@/lib/coins/catalog";
import { goldSvg } from "@/lib/brand/gold-svg";

function quote(mid: number): CoinQuote {
  return { code: "EMAMI", mid, high24h: null, low24h: null, changePct24h: 0, observedAt: "" };
}

describe("coin catalogue", () => {
  it("gives every product a distinct tgju symbol", () => {
    const symbols = COIN_CODES.map((c) => COINS[c].tgjuSymbol);
    expect(new Set(symbols).size).toBe(symbols.length);
  });

  it("keeps the fractions exact fractions of the full coin", () => {
    // A half coin is half a full coin's gold and a quarter is a quarter. If
    // these ever drift, the premium on the fractions silently goes wrong.
    expect(COINS.NIM.fineGrams).toBeCloseTo(COINS.EMAMI.fineGrams / 2, 3);
    expect(COINS.ROB.fineGrams).toBeCloseTo(COINS.EMAMI.fineGrams / 4, 3);
  });

  it("draws every product without throwing", () => {
    for (const code of COIN_CODES) {
      const svg = goldSvg(code, `t${code}`);
      expect(svg.startsWith("<svg"), code).toBe(true);
      // No NaN can reach the markup: one bad number turns the whole coin into
      // an invisible element rather than a visibly wrong one.
      expect(svg.includes("NaN"), `${code} produced NaN`).toBe(false);
    }
  });
});

describe("coin pricing", () => {
  it("puts the buy above and the sell below the market", () => {
    expect(coinBuyPrice(100_000_000, 150)).toBe(101_500_000);
    expect(coinSellPrice(100_000_000, 150)).toBe(98_500_000);
  });

  it("returns whole Toman, never a fraction", () => {
    // Money is integer minor units everywhere in this app, and a coin price
    // with a decimal would be the one that breaks a bigint column.
    expect(Number.isInteger(coinBuyPrice(219_040_333, 137))).toBe(true);
    expect(Number.isInteger(coinSellPrice(219_040_333, 137))).toBe(true);
  });
});

describe("coinPremiumPct", () => {
  // One gram of 18-carat at 22,000,000 Toman means 0.75 g fine costs that, so
  // fine gold is 29,333,333/g and a 7.32 g coin holds 214,720,000 of metal.
  const gram: CoinQuote = { ...quote(22_000_000), code: "GERAM18" };

  it("is zero when a coin costs exactly its metal", () => {
    const metal = (22_000_000 / 0.75) * COINS.EMAMI.fineGrams;
    expect(coinPremiumPct(quote(metal), gram, "EMAMI")).toBeCloseTo(0, 6);
  });

  it("is positive when the coin costs more than its metal", () => {
    const metal = (22_000_000 / 0.75) * COINS.EMAMI.fineGrams;
    const premium = coinPremiumPct(quote(metal * 1.2), gram, "EMAMI");
    expect(premium).toBeCloseTo(20, 4);
  });

  it("is negative when the coin is below its metal", () => {
    const metal = (22_000_000 / 0.75) * COINS.EMAMI.fineGrams;
    expect(coinPremiumPct(quote(metal * 0.9), gram, "EMAMI")).toBeCloseTo(-10, 4);
  });

  it("returns null rather than a wrong number when a price is missing", () => {
    expect(coinPremiumPct(undefined, gram, "EMAMI")).toBeNull();
    expect(coinPremiumPct(quote(1), undefined, "EMAMI")).toBeNull();
    expect(coinPremiumPct(quote(1), { ...quote(0), code: "GERAM18" }, "EMAMI")).toBeNull();
  });

  it("gives the gram itself no premium against itself", () => {
    expect(coinPremiumPct(gram, gram, "GERAM18")).toBeCloseTo(0, 6);
  });
});
