import { describe, expect, it } from "vitest";
import { BANK_MARKS, BANK_MARK_BY_ID, markFor } from "@/lib/banks/marks";
import { IRANIAN_BANKS, bankById, bankFromSheba, validateSheba } from "@/lib/validators";

describe("bank reference data", () => {
  it("gives every bank a mark that exists", () => {
    for (const bank of IRANIAN_BANKS) {
      const mark = BANK_MARK_BY_ID[bank.id];
      expect(mark, `${bank.id} has no mark`).toBeDefined();
      expect(BANK_MARKS[mark!], `${bank.id} points at a mark that is not drawn`).toBeTruthy();
    }
  });

  it("never gives two banks the same shape and the same colour", () => {
    // Ten shapes across twenty banks means shapes repeat by design. What must
    // not repeat is the pair — that is what makes a tile identifiable at 36px.
    const pairs = IRANIAN_BANKS.map((b) => `${markFor(b.id)}/${b.color}`);
    expect(new Set(pairs).size).toBe(IRANIAN_BANKS.length);
  });

  it("gives every bank a distinct central-bank code", () => {
    const codes = IRANIAN_BANKS.map((b) => b.ibanCode);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) expect(code).toMatch(/^\d{3}$/);
  });

  it("falls back rather than throwing on a bank it does not know", () => {
    expect(bankById("not-a-bank")).toBeNull();
    expect(bankById(null)).toBeNull();
    expect(BANK_MARKS[markFor("not-a-bank")]).toBeTruthy();
  });
});

describe("bankFromSheba", () => {
  it("names the bank from the three digits the sheba carries", () => {
    // Positions 5–7 of an Iranian IBAN are the issuing bank's code: 054 is
    // Parsian, and this sheba is mod-97 valid so the digits are trustworthy.
    const sheba = "IR820540102680020817909002";
    expect(validateSheba(sheba).valid).toBe(true);
    expect(bankFromSheba(sheba)?.id).toBe("parsian");
  });

  it("accepts the same number spaced, lowercase, or without the IR", () => {
    for (const input of [
      "IR82 0540 1026 8002 0817 9090 02",
      "ir820540102680020817909002",
      "820540102680020817909002",
    ]) {
      expect(bankFromSheba(input)?.id, input).toBe("parsian");
    }
  });

  it("returns null rather than guessing on anything malformed", () => {
    for (const input of ["", "IR82", "IR8205401026800208179090021", "hello"]) {
      expect(bankFromSheba(input), input).toBeNull();
    }
  });

  it("returns null for a well-formed sheba on a bank we do not list", () => {
    // 999 is not an assigned code. Naming *some* bank here would be worse than
    // naming none: the operator would trust it.
    expect(bankFromSheba("IR999990102680020817909002")).toBeNull();
  });
});
