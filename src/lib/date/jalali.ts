/**
 * Jalali ↔ Gregorian conversion (§6: Jalali picker for fa, Gregorian for en).
 *
 * Built on the platform's own Persian calendar (`Intl` with `ca-persian`,
 * backed by ICU) rather than a transcribed leap-year table. A date of birth
 * that silently shifts by a day is a compliance defect, not a formatting one,
 * so the authoritative implementation wins over a hand-rolled one.
 *
 * Storage is always Gregorian ISO; Jalali exists only for input and display.
 */

export interface JalaliDate {
  jy: number;
  jm: number;
  jd: number;
}

const DAY_MS = 86_400_000;

/** Cumulative days before each Jalali month — exact, leap year or not. */
const MONTH_OFFSET = [0, 31, 62, 93, 124, 155, 186, 216, 246, 276, 306, 336];

const persianParts = new Intl.DateTimeFormat("en-u-ca-persian", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  timeZone: "UTC",
});

function digits(value: string | undefined): number {
  return Number((value ?? "").replace(/\D/g, ""));
}

export function gregorianToJalali(date: Date): JalaliDate {
  const parts = persianParts.formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    digits(parts.find((p) => p.type === type)?.value);
  return { jy: pick("year"), jm: pick("month"), jd: pick("day") };
}

function dayOfYear(jm: number, jd: number): number {
  return (MONTH_OFFSET[jm - 1] ?? 0) + jd;
}

/**
 * The Gregorian day on which Farvardin 1 of `jy` falls.
 *
 * Nowruz always lands on 19–22 March, so a short scan anchored there settles
 * it exactly — no leap-year arithmetic of our own, and therefore no leap-year
 * bug of our own.
 */
function nowruz(jy: number): number {
  for (let day = 19; day <= 23; day += 1) {
    const ms = Date.UTC(jy + 621, 2, day);
    const parts = gregorianToJalali(new Date(ms));
    if (parts.jy === jy && parts.jm === 1 && parts.jd === 1) return ms;
  }
  // Unreachable for any year the Persian calendar covers; fail loudly rather
  // than silently returning a date that is off by days.
  throw new RangeError(`Could not locate Nowruz for Jalali year ${jy}`);
}

/**
 * Converts a Jalali date to UTC midnight of the matching Gregorian day.
 * Day offsets inside a Jalali year are fixed, so anchoring on Nowruz and
 * adding the day-of-year is exact for every month, Esfand included.
 */
export function jalaliToGregorian(jy: number, jm: number, jd: number): Date {
  return new Date(nowruz(jy) + (dayOfYear(jm, jd) - 1) * DAY_MS);
}

/** 31 for months 1–6, 30 for 7–11, and 29 or 30 for Esfand, per the calendar. */
export function jalaliMonthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  const esfand29 = jalaliToGregorian(jy, 12, 29);
  return gregorianToJalali(new Date(esfand29.getTime() + DAY_MS)).jm === 12 ? 30 : 29;
}

export const JALALI_MONTHS_FA = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

/** ISO yyyy-mm-dd for storage — the database always holds Gregorian. */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
