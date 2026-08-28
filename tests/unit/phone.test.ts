import { describe, expect, it } from "vitest";
import { maskPhone, normalizeIranianPhone } from "@/lib/sms/types";

describe("normalizeIranianPhone", () => {
  it("accepts every common way an Iranian number is written", () => {
    const expected = "+989123456789";
    for (const input of [
      "09123456789",
      "9123456789",
      "+989123456789",
      "00989123456789",
      "989123456789",
      "0912 345 6789",
      "0912-345-6789",
      "۰۹۱۲۳۴۵۶۷۸۹",
    ]) {
      expect(normalizeIranianPhone(input)).toBe(expected);
    }
  });

  it("rejects anything that is not an Iranian mobile number", () => {
    for (const input of ["0212345678", "12345", "+447700900123", "0812345678", ""]) {
      expect(normalizeIranianPhone(input)).toBeNull();
    }
  });
});

describe("maskPhone", () => {
  it("keeps the country prefix and last three digits only", () => {
    expect(maskPhone("+989123456789")).toBe("+9891••••789");
  });
  it("fully masks anything too short to partially reveal", () => {
    expect(maskPhone("+9891")).toBe("•••••");
  });
});
