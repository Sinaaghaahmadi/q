/**
 * Iranian national code (کد ملی) checksum validation (§6).
 * 10 digits; check digit per the official mod-11 algorithm.
 */
export function validateNationalCode(input: string): boolean {
  const code = input.replace(/[\s-]/g, "");
  if (!/^\d{10}$/.test(code)) return false;
  // All-identical digits are structurally valid but not issued.
  if (/^(\d)\1{9}$/.test(code)) return false;

  const check = Number(code[9]);
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number(code[i]) * (10 - i);
  }
  const remainder = sum % 11;
  return remainder < 2 ? check === remainder : check === 11 - remainder;
}
