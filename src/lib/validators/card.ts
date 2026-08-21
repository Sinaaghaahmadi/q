/**
 * Iranian bank card validation (§6): Luhn checksum + BIN → bank lookup.
 * Bank names resolve through i18n keys (`banks.<id>`), never hard-coded strings.
 */

export function luhnValid(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

export interface IranianBank {
  id: string;
  bins: string[];
}

export const IRANIAN_BANKS: IranianBank[] = [
  { id: "melli", bins: ["603799"] },
  { id: "sepah", bins: ["589210"] },
  { id: "mellat", bins: ["610433", "991975"] },
  { id: "tejarat", bins: ["627353", "585983"] },
  { id: "saderat", bins: ["603769"] },
  { id: "keshavarzi", bins: ["603770", "639217"] },
  { id: "maskan", bins: ["628023"] },
  { id: "refah", bins: ["589463"] },
  { id: "parsian", bins: ["622106", "639194", "627884"] },
  { id: "pasargad", bins: ["639347", "502229"] },
  { id: "saman", bins: ["621986"] },
  { id: "eghtesadNovin", bins: ["627412"] },
  { id: "ansar", bins: ["627381"] },
  { id: "postbank", bins: ["627760"] },
  { id: "ayandeh", bins: ["636214"] },
  { id: "shahr", bins: ["502806", "504706"] },
  { id: "day", bins: ["502938"] },
  { id: "sina", bins: ["639346"] },
  { id: "sarmayeh", bins: ["639607"] },
  { id: "tosee", bins: ["628157"] },
];

export type CardValidation =
  | { valid: true; bankId: string | null; masked: string }
  | { valid: false; error: "format" | "checksum" };

export function validateIranianCard(input: string): CardValidation {
  const digits = input.replace(/[\s-]/g, "");
  if (!/^\d{16}$/.test(digits)) return { valid: false, error: "format" };
  if (!luhnValid(digits)) return { valid: false, error: "checksum" };

  const bin = digits.slice(0, 6);
  const bank = IRANIAN_BANKS.find((b) => b.bins.includes(bin));
  const masked = `${digits.slice(0, 4)} •••• •••• ${digits.slice(12)}`;
  return { valid: true, bankId: bank?.id ?? null, masked };
}
