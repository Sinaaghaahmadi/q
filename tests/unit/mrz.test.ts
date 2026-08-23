import { describe, expect, it } from "vitest";
import { checkDigit, readMrz } from "@/lib/kyc/mrz";

/**
 * The specimen MRZ published in ICAO Doc 9303 Part 4, and the ID-card and
 * travel-document specimens from Parts 5 and 6. They are the documents the
 * standard itself uses as worked examples, so their check digits are the ones
 * the arithmetic here has to reproduce.
 */
const TD3 = [
  "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<",
  "L898902C36UTO7408122F1204159ZE184226B<<<<<10",
].join("\n");

const TD1 = [
  "I<UTOD231458907<<<<<<<<<<<<<<<",
  "7408122F1204159UTO<<<<<<<<<<<6",
  "ERIKSSON<<ANNA<MARIA<<<<<<<<<<",
].join("\n");

const TD2 = ["I<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<", "D231458907UTO7408122F1204159<<<<<<<6"].join(
  "\n",
);

// Fixed so the two-digit-year rule is deterministic rather than dependent on
// when the suite happens to run.
const NOW = new Date("2026-08-23T00:00:00Z");

describe("checkDigit", () => {
  it("reproduces the worked examples in ICAO 9303", () => {
    expect(checkDigit("L898902C3")).toBe(6);
    expect(checkDigit("740812")).toBe(2);
    expect(checkDigit("120415")).toBe(9);
  });

  it("refuses input outside the MRZ alphabet rather than scoring it", () => {
    // A lower-case or punctuation character means the caller handed us
    // something that is not an MRZ; returning 0 would look like a valid digit.
    expect(checkDigit("L898902c3")).toBe(-1);
    expect(checkDigit("74-08-12")).toBe(-1);
  });
});

describe("readMrz", () => {
  it("reads a passport (TD3)", () => {
    const r = readMrz(TD3, NOW);
    expect(r).not.toBeNull();
    expect(r?.format).toBe("TD3");
    expect(r?.documentNumber).toBe("L898902C3");
    expect(r?.surname).toBe("ERIKSSON");
    expect(r?.givenNames).toBe("ANNA MARIA");
    expect(r?.nationality).toBe("UTO");
    expect(r?.dateOfBirth).toBe("1974-08-12");
    expect(r?.dateOfExpiry).toBe("2012-04-15");
    expect(r?.sex).toBe("F");
  });

  it("reads an ID card (TD1) and a travel document (TD2)", () => {
    const td1 = readMrz(TD1, NOW);
    expect(td1?.format).toBe("TD1");
    expect(td1?.documentNumber).toBe("D23145890");
    expect(td1?.surname).toBe("ERIKSSON");
    expect(td1?.dateOfBirth).toBe("1974-08-12");

    const td2 = readMrz(TD2, NOW);
    expect(td2?.format).toBe("TD2");
    expect(td2?.documentNumber).toBe("D23145890");
    expect(td2?.givenNames).toBe("ANNA MARIA");
  });

  it("returns nothing when a single character was misread", () => {
    // This is the whole reason the module exists. One digit of the date of
    // birth changed: the field still looks like a date, and its check digit no
    // longer agrees, so the read is refused rather than pre-filling a form with
    // a birthday that is a year out.
    const corrupted = TD3.replace("7408122F", "7508122F");
    expect(readMrz(corrupted, NOW)).toBeNull();
  });

  it("returns nothing when the composite digit disagrees", () => {
    // Every individual field can check out while the line as a whole does not —
    // which is what a substituted field looks like.
    const corrupted = TD3.replace("B<<<<<10", "B<<<<<11");
    expect(readMrz(corrupted, NOW)).toBeNull();
  });

  it("survives the noise OCR puts around the zone", () => {
    const noisy = [
      "PASSPORT  /  PASSEPORT",
      "Type P   Code UTO   Passport No L898902C3",
      "",
      "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<",
      "L898902C36UTO7408122F1204159ZE184226B<<<<<10",
      "  ",
    ].join("\n");
    expect(readMrz(noisy, NOW)?.documentNumber).toBe("L898902C3");
  });

  it("repairs the classic OCR-B confusions inside numeric fields only", () => {
    // O for 0 and I for 1 in the dates; the name must not be touched by the
    // same substitution, which is why it is applied per field.
    const misread = TD3.replace("7408122F1204159", "74O8122F12O4I59");
    const r = readMrz(misread, NOW);
    expect(r?.dateOfBirth).toBe("1974-08-12");
    expect(r?.dateOfExpiry).toBe("2012-04-15");
    expect(r?.surname).toBe("ERIKSSON");
  });

  it("puts a two-digit birth year in the century that is in the past", () => {
    // `74` cannot be 2074 for somebody holding the document today; the rule is
    // decided by the field's role, because no check digit can catch a date that
    // is arithmetically perfect and a century wrong.
    expect(readMrz(TD3, NOW)?.dateOfBirth.startsWith("19")).toBe(true);
  });

  it("rejects a date the calendar does not have", () => {
    // 31 February passes every field-shape test and is still not a date, so the
    // check digit is recomputed for the substituted value to isolate the
    // calendar rule from the arithmetic one.
    const feb31 = "740231";
    const cd = checkDigit(feb31);
    const line2 = `L898902C36UTO${feb31}${cd}F1204159ZE184226B<<<<<10`;
    expect(readMrz(`${TD3.split("\n")[0]}\n${line2}`, NOW)).toBeNull();
  });

  it("returns nothing for text with no zone in it at all", () => {
    expect(readMrz("just some words on a page", NOW)).toBeNull();
    expect(readMrz("", NOW)).toBeNull();
  });
});
