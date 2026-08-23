/**
 * The machine-readable zone of a travel document.
 *
 * This file has no OCR in it. It takes lines of text — however they were
 * obtained — and decides whether they are a real MRZ, then what they say. That
 * separation is the whole point: character recognition on a phone photo is
 * unreliable, and an unreliable *reading* is only dangerous if nothing checks
 * it. ICAO 9303 puts a check digit after every field that matters and a
 * composite over all of them, so a misread almost always fails arithmetic
 * rather than silently producing a plausible wrong date of birth.
 *
 * So the contract here is: either every check digit passes and the caller may
 * trust the fields, or the read is rejected and the caller asks for another
 * photo. There is no middle setting where we pre-fill a form with something we
 * are not sure about — a wrong date a customer does not notice is worse than an
 * empty field they have to type.
 */

/** Character values for the ICAO check-digit weighting: `<` is 0, A is 10. */
function charValue(ch: string): number {
  if (ch >= "0" && ch <= "9") return ch.charCodeAt(0) - 48;
  if (ch >= "A" && ch <= "Z") return ch.charCodeAt(0) - 55;
  if (ch === "<") return 0;
  return -1;
}

/**
 * ICAO 9303 check digit: weights cycle 7, 3, 1 and the sum is taken mod 10.
 *
 * Returns -1 for input containing anything outside the MRZ alphabet, which the
 * callers treat as a failed check rather than as a zero.
 */
export function checkDigit(input: string): number {
  const weights = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < input.length; i += 1) {
    const value = charValue(input[i] ?? "");
    if (value < 0) return -1;
    sum += value * (weights[i % 3] ?? 1);
  }
  return sum % 10;
}

function digitAt(line: string, index: number): number {
  const ch = line[index];
  return ch !== undefined && ch >= "0" && ch <= "9" ? ch.charCodeAt(0) - 48 : -1;
}

/** True when `field`'s own check digit agrees with the field. */
function fieldOk(field: string, digit: number): boolean {
  return digit >= 0 && checkDigit(field) === digit;
}

/**
 * A YYMMDD field as a real date.
 *
 * Two digits of year need a century, and the right rule depends on which field
 * it is. A birth year is in the past; an expiry is not far in either direction.
 * Getting this wrong by a century is the one misreading the check digits cannot
 * catch — the digits are correct, the interpretation is not — so it is decided
 * by role, never guessed.
 */
function parseDate(field: string, role: "birth" | "expiry", now: Date): string | null {
  if (!/^\d{6}$/.test(field)) return null;
  const yy = Number(field.slice(0, 2));
  const mm = Number(field.slice(2, 4));
  const dd = Number(field.slice(4, 6));
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;

  const currentYY = now.getUTCFullYear() % 100;
  const century =
    role === "birth"
      ? yy > currentYY
        ? 1900
        : 2000
      : // An expiry more than a few years behind us is a document from the
        // previous century only in theory; in practice it is the next one.
        yy < currentYY - 20
        ? 2100
        : 2000;
  const year = century + yy;

  // Reject a date the calendar does not have — 31 February passes the field
  // checks above and is still not a date.
  const date = new Date(Date.UTC(year, mm - 1, dd));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== mm - 1 || date.getUTCDate() !== dd) {
    return null;
  }
  return `${String(year).padStart(4, "0")}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

/**
 * The name field: surname, then `<<`, then given names separated by `<`.
 *
 * Filler `<` becomes a space and the trailing run is dropped. Nothing is
 * title-cased: an MRZ is upper-case by construction and a passport holder whose
 * name is "MCDONALD" is not "Mcdonald".
 */
function parseNames(field: string): { surname: string; given: string } {
  const [rawSurname = "", rawGiven = ""] = field.split("<<");
  const clean = (s: string) => s.replace(/</g, " ").replace(/\s+/g, " ").trim();
  return { surname: clean(rawSurname), given: clean(rawGiven) };
}

export type MrzFormat = "TD1" | "TD2" | "TD3";

export interface MrzResult {
  format: MrzFormat;
  documentNumber: string;
  surname: string;
  givenNames: string;
  /** Three-letter issuing state or nationality, as printed. */
  nationality: string;
  issuer: string;
  /** ISO `YYYY-MM-DD`. */
  dateOfBirth: string;
  dateOfExpiry: string;
  sex: "M" | "F" | "X";
  /** Which check digits passed. All of them must, for a result to be returned. */
  checks: { document: boolean; birth: boolean; expiry: boolean; composite: boolean };
}

/**
 * Strip everything that is not MRZ alphabet and keep lines of plausible length.
 *
 * OCR habitually returns the line above the MRZ, page furniture, and stray
 * punctuation. Rather than trusting a recogniser to have found exactly the
 * band, this takes whatever came back and looks for the shape.
 */
function candidateLines(raw: string): string[] {
  return raw
    .toUpperCase()
    .split(/\r?\n/)
    .map((line) => line.replace(/[^A-Z0-9<]/g, ""))
    .filter((line) => line.length >= 28);
}

/**
 * Common OCR confusions, applied only where the format says a digit belongs.
 *
 * `O`/`0`, `I`/`1`, `S`/`5`, `B`/`8` are the classic OCR-B pairs. Correcting
 * them blindly across the whole line would corrupt names; correcting them only
 * inside numeric fields is safe, and the check digit still has the last word.
 */
function digitsOnly(field: string): string {
  return field.replace(/[OQD]/g, "0").replace(/[IL]/g, "1").replace(/S/g, "5").replace(/B/g, "8");
}

/**
 * The same repair pointed the other way, for fields that hold only letters.
 *
 * The issuing state and nationality are three-letter ICAO codes, and a
 * recogniser reading `UTO` as `UT0` fails the composite check digit — which is
 * a correct refusal of a document that was in fact read correctly everywhere it
 * mattered. Observed on the first real run, so it is repaired rather than
 * tolerated.
 */
function lettersOnly(field: string): string {
  return field.replace(/0/g, "O").replace(/1/g, "I").replace(/5/g, "S").replace(/8/g, "B");
}

function pad(line: string, length: number): string {
  return line.length >= length ? line.slice(0, length) : line.padEnd(length, "<");
}

function readTd3(l1: string, l2: string, now: Date): MrzResult | null {
  const a = pad(l1, 44);
  const b = pad(l2, 44);

  const documentNumber = b.slice(0, 9);
  const documentCd = digitAt(b, 9);
  const nationality = lettersOnly(b.slice(10, 13));
  const birth = digitsOnly(b.slice(13, 19));
  const birthCd = digitAt(b, 19);
  const sexChar = b[20] ?? "<";
  const expiry = digitsOnly(b.slice(21, 27));
  const expiryCd = digitAt(b, 27);
  const personal = b.slice(28, 42);
  const personalCd = digitAt(b, 42);
  const compositeCd = digitAt(b, 43);

  const composite =
    b.slice(0, 10) + birth + String(birthCd) + expiry + String(expiryCd) + personal + b[42];

  const checks = {
    document: fieldOk(documentNumber, documentCd),
    birth: fieldOk(birth, birthCd),
    expiry: fieldOk(expiry, expiryCd),
    // The personal-number field is optional and often all filler; when it is,
    // its check digit is `<`, which is not a digit and is treated as zero.
    composite: compositeCd >= 0 && checkDigit(composite) === compositeCd && personalCd >= -1,
  };

  const dateOfBirth = parseDate(birth, "birth", now);
  const dateOfExpiry = parseDate(expiry, "expiry", now);
  if (!dateOfBirth || !dateOfExpiry) return null;

  const { surname, given } = parseNames(a.slice(5));
  return {
    format: "TD3",
    documentNumber: documentNumber.replace(/</g, ""),
    surname,
    givenNames: given,
    nationality,
    issuer: lettersOnly(a.slice(2, 5)).replace(/</g, ""),
    dateOfBirth,
    dateOfExpiry,
    sex: sexChar === "F" ? "F" : sexChar === "M" ? "M" : "X",
    checks,
  };
}

function readTd1(l1: string, l2: string, l3: string, now: Date): MrzResult | null {
  const a = pad(l1, 30);
  const b = pad(l2, 30);
  const c = pad(l3, 30);

  const documentNumber = a.slice(5, 14);
  const documentCd = digitAt(a, 14);
  const optional1 = a.slice(15, 30);

  const birth = digitsOnly(b.slice(0, 6));
  const birthCd = digitAt(b, 6);
  const sexChar = b[7] ?? "<";
  const expiry = digitsOnly(b.slice(8, 14));
  const expiryCd = digitAt(b, 14);
  const nationality = lettersOnly(b.slice(15, 18));
  const optional2 = b.slice(18, 29);
  const compositeCd = digitAt(b, 29);

  const composite =
    a.slice(5, 30) + birth + String(birthCd) + expiry + String(expiryCd) + optional2;

  const checks = {
    document: fieldOk(documentNumber, documentCd),
    birth: fieldOk(birth, birthCd),
    expiry: fieldOk(expiry, expiryCd),
    composite: compositeCd >= 0 && checkDigit(composite) === compositeCd,
  };
  void optional1;

  const dateOfBirth = parseDate(birth, "birth", now);
  const dateOfExpiry = parseDate(expiry, "expiry", now);
  if (!dateOfBirth || !dateOfExpiry) return null;

  const { surname, given } = parseNames(c);
  return {
    format: "TD1",
    documentNumber: documentNumber.replace(/</g, ""),
    surname,
    givenNames: given,
    nationality,
    issuer: lettersOnly(a.slice(2, 5)).replace(/</g, ""),
    dateOfBirth,
    dateOfExpiry,
    sex: sexChar === "F" ? "F" : sexChar === "M" ? "M" : "X",
    checks,
  };
}

function readTd2(l1: string, l2: string, now: Date): MrzResult | null {
  const a = pad(l1, 36);
  const b = pad(l2, 36);

  const documentNumber = b.slice(0, 9);
  const documentCd = digitAt(b, 9);
  const nationality = lettersOnly(b.slice(10, 13));
  const birth = digitsOnly(b.slice(13, 19));
  const birthCd = digitAt(b, 19);
  const sexChar = b[20] ?? "<";
  const expiry = digitsOnly(b.slice(21, 27));
  const expiryCd = digitAt(b, 27);
  const optional = b.slice(28, 35);
  const compositeCd = digitAt(b, 35);

  const composite = b.slice(0, 10) + birth + String(birthCd) + expiry + String(expiryCd) + optional;

  const checks = {
    document: fieldOk(documentNumber, documentCd),
    birth: fieldOk(birth, birthCd),
    expiry: fieldOk(expiry, expiryCd),
    composite: compositeCd >= 0 && checkDigit(composite) === compositeCd,
  };

  const dateOfBirth = parseDate(birth, "birth", now);
  const dateOfExpiry = parseDate(expiry, "expiry", now);
  if (!dateOfBirth || !dateOfExpiry) return null;

  const { surname, given } = parseNames(a.slice(5));
  return {
    format: "TD2",
    documentNumber: documentNumber.replace(/</g, ""),
    surname,
    givenNames: given,
    nationality,
    issuer: lettersOnly(a.slice(2, 5)).replace(/</g, ""),
    dateOfBirth,
    dateOfExpiry,
    sex: sexChar === "F" ? "F" : sexChar === "M" ? "M" : "X",
    checks,
  };
}

/**
 * Find and read a machine-readable zone in whatever text came back.
 *
 * Every plausible pair or triple of lines is tried, and the first that passes
 * **all** its check digits wins. A candidate that parses but fails a check is
 * not returned at all — see the note at the top of this file.
 *
 * `now` is a parameter rather than a call to the clock so the century rule is
 * testable and so two calls in the same session cannot disagree.
 */
export function readMrz(text: string, now: Date = new Date()): MrzResult | null {
  const lines = candidateLines(text);
  const passed = (r: MrzResult | null): MrzResult | null =>
    r && r.checks.document && r.checks.birth && r.checks.expiry && r.checks.composite ? r : null;

  for (let i = 0; i + 1 < lines.length; i += 1) {
    const l1 = lines[i] ?? "";
    const l2 = lines[i + 1] ?? "";
    const l3 = lines[i + 2];

    // Gated on the *second* line's length, never the first. Line one is a name
    // followed by a long run of `<` filler, and a recogniser trained on text
    // drops trailing filler as readily as it drops trailing whitespace — the
    // first run of this returned a 36-character line one for a 44-character
    // TD3 and the format was never even attempted. Line two is all data, and
    // `pad` supplies whatever line one is missing.
    if (l2.length >= 40) {
      const td3 = passed(readTd3(l1, l2, now));
      if (td3) return td3;
    }
    if (l3 !== undefined && l2.length <= 32) {
      const td1 = passed(readTd1(l1, l2, l3, now));
      if (td1) return td1;
    }
    if (l2.length >= 33 && l2.length <= 39) {
      const td2 = passed(readTd2(l1, l2, now));
      if (td2) return td2;
    }
  }
  return null;
}
