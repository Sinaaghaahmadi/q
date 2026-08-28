import { describe, expect, it } from "vitest";
import { luhnValid, validateIranianCard } from "@/lib/validators/card";
import { validateIban, validateSheba } from "@/lib/validators/iban";
import { validateNationalCode } from "@/lib/validators/national-code";

describe("IBAN / Sheba (mod-97)", () => {
  it("accepts a valid international IBAN", () => {
    expect(validateIban("DE89 3704 0044 0532 0130 00")).toMatchObject({
      valid: true,
      country: "DE",
    });
    expect(validateIban("GB29NWBK60161331926819")).toMatchObject({ valid: true, country: "GB" });
    expect(validateIban("TR330006100519786457841326")).toMatchObject({
      valid: true,
      country: "TR",
    });
  });

  it("rejects a checksum failure", () => {
    expect(validateIban("DE89370400440532013001")).toMatchObject({ valid: false });
    expect(validateIban("GB29NWBK60161331926810")).toMatchObject({
      valid: false,
      error: "checksum",
    });
  });

  it("rejects wrong lengths for known countries", () => {
    expect(validateIban("DE8937040044053201300")).toMatchObject({ valid: false, error: "length" });
  });

  it("validates Iranian Sheba with and without the IR prefix", () => {
    // Constructed valid Sheba: bank 012 + 22-digit BBAN; check digits found below.
    const body = "0120000000001234567890";
    // find the check digits programmatically to keep the fixture honest
    let valid: string | null = null;
    for (let i = 2; i <= 98; i++) {
      const candidate = `IR${String(i).padStart(2, "0")}${body}`;
      if (validateIban(candidate).valid) {
        valid = candidate;
        break;
      }
    }
    expect(valid).not.toBeNull();
    expect(validateSheba(valid as string).valid).toBe(true);
    expect(validateSheba((valid as string).slice(2)).valid).toBe(true);
    expect(validateSheba("IR000000000000000000000001").valid).toBe(false);
  });

  it("rejects non-Sheba formats", () => {
    expect(validateSheba("DE89370400440532013000")).toMatchObject({ valid: false });
    expect(validateSheba("IR12abc")).toMatchObject({ valid: false });
  });
});

describe("Iranian card (Luhn + BIN)", () => {
  it("validates Luhn", () => {
    expect(luhnValid("4539578763621486")).toBe(true);
    expect(luhnValid("4539578763621487")).toBe(false);
  });

  it("finds the bank from the BIN", () => {
    // Bank Melli BIN 603799 + Luhn-valid tail
    const base = "603799000000000";
    for (let d = 0; d <= 9; d++) {
      const card = base + String(d);
      if (luhnValid(card)) {
        const result = validateIranianCard(card);
        expect(result).toMatchObject({ valid: true, bankId: "melli" });
        if (result.valid) {
          expect(result.masked).toContain("••••");
        }
        return;
      }
    }
    throw new Error("no Luhn-valid digit found");
  });

  it("rejects malformed input", () => {
    expect(validateIranianCard("60379900")).toMatchObject({ valid: false, error: "format" });
  });
});

describe("Iranian national code", () => {
  it("accepts valid codes", () => {
    // Known-structure fixture: checksum computed by the same published algorithm
    // used by the registry; 0499370899 is a commonly cited valid example.
    expect(validateNationalCode("0499370899")).toBe(true);
  });

  it("rejects invalid checksums, repeats, and formats", () => {
    expect(validateNationalCode("0499370898")).toBe(false);
    expect(validateNationalCode("1111111111")).toBe(false);
    expect(validateNationalCode("12345")).toBe(false);
    expect(validateNationalCode("abcdefghij")).toBe(false);
  });
});
