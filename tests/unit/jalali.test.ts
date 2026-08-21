import { describe, expect, it } from "vitest";
import {
  gregorianToJalali,
  jalaliMonthLength,
  jalaliToGregorian,
  toIsoDate,
} from "@/lib/date/jalali";

describe("Jalali ↔ Gregorian", () => {
  it("maps known anchor dates exactly", () => {
    // Nowruz 1400 fell on 2021-03-21.
    expect(toIsoDate(jalaliToGregorian(1400, 1, 1))).toBe("2021-03-21");
    // Nowruz 1403 fell on 2024-03-20 (a leap-year shift).
    expect(toIsoDate(jalaliToGregorian(1403, 1, 1))).toBe("2024-03-20");
    // Last day of Esfand 1399 — 1399 was a Jalali leap year, so 30 Esfand exists.
    expect(toIsoDate(jalaliToGregorian(1399, 12, 30))).toBe("2021-03-20");
  });

  it("round-trips every day of a sample year", () => {
    for (let m = 1; m <= 12; m += 1) {
      const days = jalaliMonthLength(1402, m);
      for (let d = 1; d <= days; d += 1) {
        const g = jalaliToGregorian(1402, m, d);
        const back = gregorianToJalali(g);
        expect([back.jy, back.jm, back.jd]).toEqual([1402, m, d]);
      }
    }
  });

  it("knows month lengths, including Esfand in leap and common years", () => {
    expect(jalaliMonthLength(1402, 1)).toBe(31);
    expect(jalaliMonthLength(1402, 7)).toBe(30);
    expect(jalaliMonthLength(1402, 12)).toBe(29);
    expect(jalaliMonthLength(1403, 12)).toBe(30);
  });

  it("converts a Gregorian date back to the expected Jalali date", () => {
    expect(gregorianToJalali(new Date(Date.UTC(2026, 7, 21)))).toEqual({
      jy: 1405,
      jm: 5,
      jd: 30,
    });
  });
});
