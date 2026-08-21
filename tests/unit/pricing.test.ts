import { describe, expect, it } from "vitest";
import {
  computeQuote,
  DEMO_SPREAD_LAYERS,
  deviationPct,
  totalSpreadBps,
} from "@/lib/rates/pricing";

describe("spread layering (§7.2)", () => {
  it("sums layers", () => {
    expect(totalSpreadBps(DEMO_SPREAD_LAYERS)).toBe(90);
  });
});

describe("computeQuote", () => {
  const mid = 189_400; // Toman per USD

  it("irt_to_foreign: ask above mid, fees off the Toman leg", () => {
    const q = computeQuote({ direction: "irt_to_foreign", sendAmount: 500_000_000, midToman: mid });
    expect(q.customerRateToman).toBeCloseTo(mid * 1.009, 5);
    expect(q.platformFeeToman).toBeCloseTo(500_000_000 * 0.0025, 5);
    expect(q.officeFeeToman).toBeCloseTo(500_000_000 * 0.0015, 5);
    const expected = (500_000_000 - q.platformFeeToman - q.officeFeeToman) / q.customerRateToman;
    expect(q.receiveAmount).toBeCloseTo(expected, 8);
    expect(q.receiveAmount).toBeLessThan(500_000_000 / mid);
  });

  it("foreign_to_irt: bid below mid", () => {
    const q = computeQuote({ direction: "foreign_to_irt", sendAmount: 1000, midToman: mid });
    expect(q.customerRateToman).toBeCloseTo(mid * 0.991, 5);
    expect(q.tomanLeg).toBeCloseTo(1000 * mid * 0.991, 3);
    expect(q.receiveAmount).toBeLessThan(q.tomanLeg);
    expect(q.receiveAmount).toBeGreaterThan(0);
  });

  it("applies fee minimums on small amounts", () => {
    const q = computeQuote({ direction: "foreign_to_irt", sendAmount: 10, midToman: mid });
    expect(q.platformFeeToman).toBe(150_000);
    expect(q.officeFeeToman).toBe(100_000);
  });

  it("returns a zero quote for non-positive input", () => {
    const q = computeQuote({ direction: "irt_to_foreign", sendAmount: 0, midToman: mid });
    expect(q.receiveAmount).toBe(0);
    expect(q.platformFeeToman).toBe(0);
  });
});

describe("guardrail deviation (§7.2)", () => {
  it("measures absolute percent deviation", () => {
    expect(deviationPct(102, 100)).toBeCloseTo(2);
    expect(deviationPct(98, 100)).toBeCloseTo(2);
    expect(deviationPct(1, 0)).toBe(Infinity);
  });
});
