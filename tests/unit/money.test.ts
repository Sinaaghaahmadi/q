import { describe, expect, it } from "vitest";
import {
  formatChangePct,
  formatDate,
  formatNumber,
  formatRate,
  parseAmountInput,
  toLatinDigits,
  toPersianDigits,
} from "@/lib/money/format";

describe("formatNumber", () => {
  it("renders Persian digits with Persian grouping in fa", () => {
    const out = formatNumber(189400, "fa", { maximumFractionDigits: 0 });
    expect(out).toContain("۱۸۹");
    expect(out).toContain("۴۰۰");
    expect(out).not.toMatch(/[0-9]/);
  });

  it("renders Latin digits in en", () => {
    expect(formatNumber(189400, "en", { maximumFractionDigits: 0 })).toBe("189,400");
  });

  it("handles non-finite values", () => {
    expect(formatNumber(Number.NaN, "en")).toBe("—");
  });
});

describe("formatRate", () => {
  it("uses whole Toman above 1000", () => {
    expect(formatRate(189400.7, "en")).toBe("189,401");
  });
  it("keeps one decimal for small-unit currencies", () => {
    expect(formatRate(133.3, "en")).toBe("133.3");
  });
});

describe("formatChangePct", () => {
  it("always carries an explicit sign", () => {
    expect(formatChangePct(0.42, "en")).toBe("+0.42%");
    expect(formatChangePct(-0.85, "en")).toBe("−0.85%");
  });
  it("uses the Persian percent sign in fa", () => {
    expect(formatChangePct(0.42, "fa")).toContain("٪");
  });
});

describe("digit conversion + input parsing", () => {
  it("round-trips Persian digits", () => {
    expect(toPersianDigits("123")).toBe("۱۲۳");
    expect(toLatinDigits("۱۲۳")).toBe("123");
    expect(toLatinDigits("٤٥٦")).toBe("456");
  });

  it("parses grouped, Persian-digit, and decimal input", () => {
    expect(parseAmountInput("1,000")).toBe(1000);
    expect(parseAmountInput("۱۲۳۴")).toBe(1234);
    expect(parseAmountInput("12.5")).toBe(12.5);
    expect(parseAmountInput("۱۲٫۵")).toBe(12.5);
  });

  it("rejects garbage", () => {
    expect(parseAmountInput("12a")).toBeNull();
    expect(parseAmountInput("")).toBeNull();
    expect(parseAmountInput("1.2.3")).toBeNull();
  });
});

describe("formatDate", () => {
  const day = new Date("2026-08-22T12:00:00Z");

  it("renders the Persian calendar in fa, not a translated Gregorian date", () => {
    // 22 August 2026 is 31 Mordad 1405 — a different month, not a different
    // spelling, which is why the calendar override is not just a locale tag.
    const rendered = formatDate(day, "fa", { month: "long", day: "numeric" });
    expect(rendered).toContain("مرداد");
    expect(rendered).toContain("۳۱");
  });

  it("renders every other locale in its own language", () => {
    // This file used to hand fr, de and ar to en-US, so a French administrator
    // read "Aug 22, 2026" on a French page.
    expect(formatDate(day, "fr", { month: "long" })).toBe("août");
    expect(formatDate(day, "de", { month: "long" })).toBe("August");
    expect(formatDate(day, "en", { month: "long" })).toBe("August");
    expect(formatDate(day, "ar", { month: "long" })).toBe("أغسطس");
  });
});
