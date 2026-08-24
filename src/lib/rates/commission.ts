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
 * headline "between 5% and 15%, less as you send more" is literally true at
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
  { upToToman: 20_000_000, pct: 15 },
  { upToToman: 100_000_000, pct: 12 },
  { upToToman: 300_000_000, pct: 10 },
  { upToToman: 1_000_000_000, pct: 8 },
  { upToToman: 3_000_000_000, pct: 6.5 },
  { upToToman: null, pct: 5 },
];

/** The band edges of the schedule, as advertised. */
export const COMMISSION_MAX_PCT = 15;
export const COMMISSION_MIN_PCT = 5;

/**
 * The platform's share of the commission — a take-rate on the office's
 * earning, not a second charge on the customer. 20% of a 10% commission is two
 * points to Asaex and eight to the office.
 */
export const PLATFORM_SHARE = 0.2;

export interface CommissionResult {
  /** Toman charged in total, across every band. */
  toman: number;
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
 * Returns zeros for a non-positive leg rather than throwing: a converter that
 * has not been typed into yet is a normal state, not an error.
 */
export function commissionOn(tomanLeg: number): CommissionResult {
  if (!Number.isFinite(tomanLeg) || tomanLeg <= 0) {
    return { toman: 0, effectivePct: 0, slices: [], marginalPct: COMMISSION_MAX_PCT };
  }

  const slices: CommissionResult["slices"] = [];
  let charged = 0;
  let floor = 0;
  let marginalPct = COMMISSION_MAX_PCT;

  for (const band of COMMISSION_BANDS) {
    const ceiling = band.upToToman ?? Infinity;
    const slice = Math.min(tomanLeg, ceiling) - floor;
    if (slice <= 0) break;
    const amount = (slice * band.pct) / 100;
    slices.push({
      pct: band.pct,
      fromToman: floor,
      toToman: Math.min(tomanLeg, ceiling),
      tomanCharged: amount,
    });
    charged += amount;
    marginalPct = band.pct;
    floor = ceiling;
    if (tomanLeg <= ceiling) break;
  }

  return {
    toman: charged,
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
): { atToman: number; effectivePct: number; marginalPct: number } | null {
  for (const band of COMMISSION_BANDS) {
    if (band.upToToman !== null && tomanLeg < band.upToToman) {
      const at = band.upToToman;
      const next = COMMISSION_BANDS[COMMISSION_BANDS.indexOf(band) + 1];
      if (!next) return null;
      return {
        atToman: at,
        effectivePct: commissionOn(at).effectivePct,
        marginalPct: next.pct,
      };
    }
  }
  return null;
}
