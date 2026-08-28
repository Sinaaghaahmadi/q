import { describe, expect, it } from "vitest";
import { fromMinor, toMinor } from "@/lib/money/minor";
import { CURRENCIES, CURRENCY_CODES } from "@/lib/rates/catalog";

describe("minor units", () => {
  it("uses each currency's own scale", () => {
    expect(toMinor(1000, "IRT")).toBe(1000); // Toman has no subunit
    expect(toMinor(1000, "USD")).toBe(100_000); // cents
    expect(toMinor(1000, "KWD")).toBe(1_000_000); // fils, three decimals
  });

  it("rounds once, on the way in", () => {
    // 0.1 + 0.2 in float is 0.30000000000000004; the boundary must not carry it.
    expect(toMinor(0.1 + 0.2, "USD")).toBe(30);
    expect(toMinor(189_400.4, "IRT")).toBe(189_400);
    expect(toMinor(189_400.6, "IRT")).toBe(189_401);
  });

  it("round-trips any value its currency can actually express", () => {
    for (const code of CURRENCY_CODES) {
      // Pick a value at this currency's own scale — 1234 for Toman, 1234.56
      // for cents, 1234.567 for fils — and it survives the trip untouched.
      const decimals = CURRENCIES[code].decimals;
      const amount = Number((1234 + 0.567).toFixed(decimals));
      expect(fromMinor(toMinor(amount, code), code)).toBe(amount);
    }
  });

  it("rounds a value finer than the currency, rather than carrying it", () => {
    // Toman has no subunit, so half a Toman has to go somewhere.
    expect(fromMinor(toMinor(1234.5, "IRT"), "IRT")).toBe(1235);
    expect(fromMinor(toMinor(1234.4, "IRT"), "IRT")).toBe(1234);
    // A third of a cent likewise.
    expect(fromMinor(toMinor(0.005, "USD"), "USD")).toBe(0.01);
  });

  it("refuses what an integer cannot hold", () => {
    expect(() => toMinor(Number.NaN, "USD")).toThrow(RangeError);
    expect(() => toMinor(1e15, "KWD")).toThrow(RangeError);
  });
});
