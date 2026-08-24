import { describe, expect, it } from "vitest";
import {
  COMMISSION_BANDS,
  COMMISSION_MAX_PCT,
  COMMISSION_MIN_PCT,
  commissionOn,
  nextBand,
  PLATFORM_SHARE,
} from "@/lib/rates/commission";
import {
  computeQuote,
  DEFAULT_SPREAD_LAYERS,
  deviationPct,
  totalSpreadBps,
  type SpreadLayer,
} from "@/lib/rates/pricing";

describe("banded commission", () => {
  it("charges the top band on a small transfer and nothing above it", () => {
    const c = commissionOn(1_000_000);
    expect(c.effectivePct).toBeCloseTo(15, 9);
    expect(c.toman).toBeCloseTo(150_000, 6);
    expect(c.slices).toHaveLength(1);
  });

  it("charges each slice at its own band, not the whole amount at one rate", () => {
    // 20M at 15% + 80M at 12% = 3,000,000 + 9,600,000
    const c = commissionOn(100_000_000);
    expect(c.toman).toBeCloseTo(12_600_000, 6);
    expect(c.effectivePct).toBeCloseTo(12.6, 9);
    expect(c.slices.map((s) => s.pct)).toEqual([15, 12]);
  });

  it("never falls below the published floor or rises above the ceiling", () => {
    for (const amount of [1, 1_000, 19_999_999, 20_000_000, 300_000_000, 1e10, 1e13]) {
      const pct = commissionOn(amount).effectivePct;
      expect(pct).toBeLessThanOrEqual(COMMISSION_MAX_PCT + 1e-9);
      expect(pct).toBeGreaterThanOrEqual(COMMISSION_MIN_PCT - 1e-9);
    }
  });

  it("costs more in Toman as the amount rises, and less as a percentage", () => {
    // The property banded slices exist to guarantee. Charging one flat rate per
    // band instead would make 101M cheaper in absolute Toman than 99M.
    let previousToman = -1;
    let previousPct = Infinity;
    for (let amount = 5_000_000; amount < 5e9; amount *= 1.35) {
      const c = commissionOn(amount);
      expect(c.toman).toBeGreaterThan(previousToman);
      expect(c.effectivePct).toBeLessThanOrEqual(previousPct + 1e-9);
      previousToman = c.toman;
      previousPct = c.effectivePct;
    }
  });

  it("is continuous across every band edge", () => {
    for (const band of COMMISSION_BANDS) {
      if (band.upToToman === null) continue;
      const below = commissionOn(band.upToToman - 1).toman;
      const above = commissionOn(band.upToToman + 1).toman;
      expect(above - below).toBeLessThan(1); // no step, only a change of slope
      expect(above).toBeGreaterThan(below);
    }
  });

  it("reports the next edge worth reaching", () => {
    const next = nextBand(50_000_000);
    expect(next?.atToman).toBe(100_000_000);
    expect(next?.marginalPct).toBe(10);
    expect(nextBand(5e9)).toBeNull();
  });

  it("returns a zero result for an empty or invalid leg", () => {
    expect(commissionOn(0).toman).toBe(0);
    expect(commissionOn(-5).toman).toBe(0);
    expect(commissionOn(Number.NaN).toman).toBe(0);
  });
});

describe("spread layering", () => {
  it("sums layers, and defaults to no rate treatment at all", () => {
    expect(totalSpreadBps(DEFAULT_SPREAD_LAYERS)).toBe(0);
    expect(totalSpreadBps([{ key: "office_markup", bps: 120 }])).toBe(120);
  });
});

describe("computeQuote", () => {
  const mid = 189_400; // Toman per USD

  it("irt_to_foreign: quotes at mid by default and charges only the commission", () => {
    const send = 500_000_000;
    const q = computeQuote({ direction: "irt_to_foreign", sendAmount: send, midToman: mid });
    expect(q.customerRateToman).toBeCloseTo(mid, 6);
    expect(q.rateMarkupToman).toBe(0);
    expect(q.platformFeeToman + q.officeFeeToman).toBeCloseTo(q.commission.toman, 5);
    expect(q.platformFeeToman).toBeCloseTo(q.commission.toman * PLATFORM_SHARE, 5);
    expect(q.receiveAmount).toBeCloseTo((send - q.commission.toman) / mid, 8);
  });

  it("foreign_to_irt: values the leg at mid so the band does not move with the spread", () => {
    const q = computeQuote({ direction: "foreign_to_irt", sendAmount: 1000, midToman: mid });
    expect(q.tomanLeg).toBeCloseTo(1000 * mid, 3);
    expect(q.receiveAmount).toBeCloseTo(q.tomanLeg - q.commission.toman, 4);
  });

  it("a rate markup comes out of the commission, never on top of it", () => {
    const layers: SpreadLayer[] = [{ key: "office_markup", bps: 300 }];
    const send = 500_000_000;
    const plain = computeQuote({ direction: "irt_to_foreign", sendAmount: send, midToman: mid });
    const marked = computeQuote({
      direction: "irt_to_foreign",
      sendAmount: send,
      midToman: mid,
      layers,
    });

    // Same total cost to the customer either way: the value of what they get,
    // priced at mid, differs by less than a Toman.
    const plainValue = plain.receiveAmount * mid;
    const markedValue = marked.receiveAmount * mid;
    expect(Math.abs(plainValue - markedValue)).toBeLessThan(1);

    // The markup moved money from the platform's share to the office's.
    expect(marked.rateMarkupToman).toBeGreaterThan(0);
    expect(marked.officeFeeToman).toBeGreaterThan(plain.officeFeeToman);
    expect(marked.platformFeeToman).toBeLessThan(plain.platformFeeToman);
    expect(marked.officeFeeToman + marked.platformFeeToman).toBeCloseTo(marked.commission.toman, 5);
  });

  it("keeps the platform's share non-negative when a markup swallows the band", () => {
    const layers: SpreadLayer[] = [{ key: "office_markup", bps: 2000 }];
    const q = computeQuote({
      direction: "foreign_to_irt",
      sendAmount: 100_000,
      midToman: mid,
      layers,
    });
    expect(q.platformFeeToman).toBeGreaterThanOrEqual(0);
    expect(q.receiveAmount).toBeGreaterThanOrEqual(0);
  });

  it("charges exactly the band, whatever the spread and whichever direction", () => {
    // The invariant the whole model rests on: what the customer loses, valued
    // at mid, is the banded commission — no more, no less.
    for (const bps of [0, 25, 120, 400, 900, 5000]) {
      const layers: SpreadLayer[] = [{ key: "office_markup", bps }];
      for (const send of [3_000_000, 90_000_000, 800_000_000, 6_000_000_000]) {
        const out = computeQuote({
          direction: "irt_to_foreign",
          sendAmount: send,
          midToman: mid,
          layers,
        });
        const cost = out.tomanLeg - out.receiveAmount * mid;
        expect(cost).toBeCloseTo(out.commission.toman, 3);
      }
      for (const send of [20, 500, 6_000, 40_000]) {
        const inbound = computeQuote({
          direction: "foreign_to_irt",
          sendAmount: send,
          midToman: mid,
          layers,
        });
        const cost = inbound.tomanLeg - inbound.receiveAmount;
        expect(cost).toBeCloseTo(inbound.commission.toman, 3);
      }
    }
  });

  it("returns a zero quote for non-positive input", () => {
    const q = computeQuote({ direction: "irt_to_foreign", sendAmount: 0, midToman: mid });
    expect(q.receiveAmount).toBe(0);
    expect(q.platformFeeToman).toBe(0);
    expect(q.commission.toman).toBe(0);
  });
});

describe("guardrail deviation", () => {
  it("measures absolute percent deviation", () => {
    expect(deviationPct(102, 100)).toBeCloseTo(2);
    expect(deviationPct(98, 100)).toBeCloseTo(2);
    expect(deviationPct(1, 0)).toBe(Infinity);
  });
});
