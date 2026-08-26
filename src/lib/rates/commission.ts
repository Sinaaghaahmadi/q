/**
 * What a transfer costs, and why that is one number rather than four.
 *
 * The exchange office's commission is banded: the first slice of a transfer is
 * charged at the top rate, each slice above it at a lower one, exactly the way
 * a tax band works. Charging one flat rate per band instead would mean that
 * sending a little more money makes the bill *smaller* — 99M at 12% is
 * 11.9M, 101M at 10% is 10.1M — which is both unfair to the person just under
 * the line and an invitation to game the boundary. Banded slices make the total
 * rise monotonically while the effective percentage falls smoothly, so the
 * headline "between 3% and 10%, less as you send more" is literally true at
 * every amount rather than true on average.
 *
 * The percentage this produces is a **ceiling on the whole cost**, not one
 * charge among several. Whatever the rate markup takes comes out of it, so a
 * customer's total is the band percentage no matter how the office and the
 * platform divide it up. That is the property worth defending: one number the
 * customer can check.
 */

/** One band. `upToToman: null` is the open-ended top band. */
export interface CommissionBand {
  /** Upper edge of the slice, in Toman. `null` means "everything above". */
  upToToman: number | null;
  pct: number;
}

/**
 * The published schedule. Edges are round Toman figures rather than currency
 * conversions, because the band a customer lands in must not move when the
 * dollar does.
 */
export const COMMISSION_BANDS: CommissionBand[] = [
  { upToToman: 20_000_000, pct: 10 },
  { upToToman: 100_000_000, pct: 8 },
  { upToToman: 300_000_000, pct: 6.5 },
  { upToToman: 1_000_000_000, pct: 5 },
  { upToToman: 3_000_000_000, pct: 4 },
  { upToToman: null, pct: 3 },
];

/**
 * The band edges of the schedule, as advertised.
 *
 * Every band moved two rungs down its own ladder: what was 15/12/10/8/6.5/5 is
 * now 10/8/6.5/5/4/3, so a transfer that cost 15% costs 10% and the floor goes
 * from 5% to 3%. The edges between the bands did not move — only the rate
 * charged inside each — so nobody changes band because of this.
 *
 * These two constants are the only place the range is written down as numbers.
 * Everything else — the fee schedule, the terms, the glossary, the calculator
 * in both panels — reads the band table, so a future change is this file and
 * the prose that quotes it, and nothing else.
 */
export const COMMISSION_MAX_PCT = 10;
export const COMMISSION_MIN_PCT = 3;

/**
 * The platform's share of the commission — a take-rate on the office's
 * earning, not a second charge on the customer. 20% of a 10% commission is two
 * points to Asaex and eight to the office.
 */
export const PLATFORM_SHARE = 0.2;

export interface CommissionResult {
  /** Toman charged in total, across every band. */
  toman: number;
  /** Percentage points taken off each band by the customer's loyalty tier. */
  discountPct: number;
  /** What that works out to as a percentage of the Toman leg. */
  effectivePct: number;
  /** Per-band detail, for the breakdown sheet. Only bands actually reached. */
  slices: { pct: number; fromToman: number; toToman: number; tomanCharged: number }[];
  /** The band the last Toman of this transfer fell in — the "marginal" rate. */
  marginalPct: number;
}

/**
 * Commission on a Toman leg, band by band.
 *
 * `discountPct` is the loyalty tier's benefit, in percentage points off each
 * band. It is clamped at the published floor rather than allowed through it: a
 * schedule that says "between 3% and 10%" has to stay true for a platinum
 * customer too, and a discount that quietly broke the lower bound would make
 * the fee document wrong rather than the customer lucky.
 *
 * Returns zeros for a non-positive leg rather than throwing: a converter that
 * has not been typed into yet is a normal state, not an error.
 */
export function commissionOn(tomanLeg: number, discountPct = 0): CommissionResult {
  const discount = Number.isFinite(discountPct) ? Math.max(0, discountPct) : 0;
  if (!Number.isFinite(tomanLeg) || tomanLeg <= 0) {
    return {
      toman: 0,
      discountPct: discount,
      effectivePct: 0,
      slices: [],
      marginalPct: COMMISSION_MAX_PCT,
    };
  }

  const slices: CommissionResult["slices"] = [];
  let charged = 0;
  let floor = 0;
  let marginalPct = COMMISSION_MAX_PCT;

  for (const band of COMMISSION_BANDS) {
    const ceiling = band.upToToman ?? Infinity;
    const slice = Math.min(tomanLeg, ceiling) - floor;
    if (slice <= 0) break;
    const rate = Math.max(COMMISSION_MIN_PCT, band.pct - discount);
    const amount = (slice * rate) / 100;
    slices.push({
      pct: rate,
      fromToman: floor,
      toToman: Math.min(tomanLeg, ceiling),
      tomanCharged: amount,
    });
    charged += amount;
    marginalPct = rate;
    floor = ceiling;
    if (tomanLeg <= ceiling) break;
  }

  return {
    toman: charged,
    discountPct: discount,
    effectivePct: (charged / tomanLeg) * 100,
    slices,
    marginalPct,
  };
}

/**
 * The next band edge above this amount, and what sending that much would cost
 * as a percentage — so the quote can say "send 4M more and your rate drops to
 * 12%" instead of leaving the customer to read a table.
 */
export function nextBand(
  tomanLeg: number,
  discountPct = 0,
): { atToman: number; effectivePct: number; marginalPct: number } | null {
  for (const band of COMMISSION_BANDS) {
    if (band.upToToman !== null && tomanLeg < band.upToToman) {
      const at = band.upToToman;
      const next = COMMISSION_BANDS[COMMISSION_BANDS.indexOf(band) + 1];
      if (!next) return null;
      return {
        atToman: at,
        effectivePct: commissionOn(at, discountPct).effectivePct,
        marginalPct: Math.max(COMMISSION_MIN_PCT, next.pct - Math.max(0, discountPct)),
      };
    }
  }
  return null;
}
