/**
 * IBAN / Sheba validation (§6): real checksum validation, not cosmetic.
 * Mod-97 per ISO 13616. Iranian Sheba = "IR" + 24 digits.
 */

const IBAN_LENGTHS: Record<string, number> = {
  IR: 26,
  TR: 26,
  AE: 23,
  GE: 22,
  DE: 22,
  FR: 27,
  GB: 22,
  NL: 18,
  ES: 24,
  IT: 27,
  BE: 16,
  AT: 20,
  CH: 21,
  SE: 24,
  NO: 15,
  DK: 18,
  FI: 18,
  PT: 25,
  IE: 22,
  LU: 20,
  QA: 29,
  SA: 24,
  KW: 30,
  AZ: 28,
  PK: 24,
  IQ: 23,
};

export function normalizeIban(input: string): string {
  return input.replace(/[\s-]/g, "").toUpperCase();
}

/** Mod-97 over the rearranged IBAN, digit-safe for arbitrary length. */
function mod97(numeric: string): number {
  let remainder = 0;
  for (let i = 0; i < numeric.length; i += 7) {
    const block = String(remainder) + numeric.slice(i, i + 7);
    remainder = Number(block) % 97;
  }
  return remainder;
}

export type IbanValidation =
  | { valid: true; country: string; formatted: string }
  | { valid: false; error: "format" | "length" | "checksum" };

export function validateIban(input: string): IbanValidation {
  const iban = normalizeIban(input);
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(iban)) return { valid: false, error: "format" };

  const country = iban.slice(0, 2);
  const expected = IBAN_LENGTHS[country];
  if (expected !== undefined && iban.length !== expected) return { valid: false, error: "length" };
  if (iban.length < 15 || iban.length > 34) return { valid: false, error: "length" };

  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55));
  if (mod97(numeric) !== 1) return { valid: false, error: "checksum" };

  const formatted = iban.replace(/(.{4})/g, "$1 ").trim();
  return { valid: true, country, formatted };
}

/** Iranian Sheba: IR + 24 digits, mod-97 valid. */
export function validateSheba(input: string): IbanValidation {
  const iban = normalizeIban(input);
  const withPrefix = iban.startsWith("IR") ? iban : `IR${iban}`;
  if (!/^IR[0-9]{24}$/.test(withPrefix)) {
    return { valid: false, error: /^IR/.test(withPrefix) ? "length" : "format" };
  }
  return validateIban(withPrefix);
}
