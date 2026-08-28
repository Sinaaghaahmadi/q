import { CURRENCIES, type CurrencyCode } from "@/lib/rates/catalog";

/**
 * Money crosses the database boundary as integer minor units (§0.5: never a
 * float). The catalog already knows each currency's decimals — Toman has none,
 * most have two, the Gulf dinars have three — so that table is the only place
 * the scale is written down.
 *
 * Rounding happens here, once, on the way in. Everything downstream is exact.
 */
export function toMinor(amount: number, currency: CurrencyCode): number {
  if (!Number.isFinite(amount)) {
    throw new RangeError(`amount is not a finite number: ${amount}`);
  }
  const scale = 10 ** CURRENCIES[currency].decimals;
  const minor = Math.round(amount * scale);
  if (!Number.isSafeInteger(minor)) {
    throw new RangeError(`${amount} ${currency} does not fit in a safe integer`);
  }
  return minor;
}

/** Minor units back to a display number. Exact for every value toMinor produces. */
export function fromMinor(minor: number, currency: CurrencyCode): number {
  return minor / 10 ** CURRENCIES[currency].decimals;
}
