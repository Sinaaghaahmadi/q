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
  /** Card BIN prefixes (first six digits). */
  bins: string[];
  /**
   * The bank's three-digit code as assigned by the central bank, which is what
   * sits at positions 5–7 of an Iranian IBAN: `IR` + 2 check digits + this + 18
   * digits of account. It is what lets us name the bank from a sheba alone,
   * without asking the person which bank it is.
   */
  ibanCode: string;
  /**
   * A single hue from the bank's own identity, for the picker's tile.
   *
   * Not a logo: bank logos are trademarks we have no licence to redistribute,
   * and twenty of them at 32px would be unreadable anyway. A coloured tile with
   * the bank's initial in Persian is recognisable at a glance and ours to ship.
   */
  color: string;
}

export const IRANIAN_BANKS: IranianBank[] = [
  { id: "melli", bins: ["603799"], ibanCode: "017", color: "#f0a500" },
  { id: "sepah", bins: ["589210"], ibanCode: "015", color: "#1a4f9c" },
  { id: "mellat", bins: ["610433", "991975"], ibanCode: "012", color: "#d6001c" },
  { id: "tejarat", bins: ["627353", "585983"], ibanCode: "018", color: "#0067b1" },
  { id: "saderat", bins: ["603769"], ibanCode: "019", color: "#0b3f8c" },
  { id: "keshavarzi", bins: ["603770", "639217"], ibanCode: "016", color: "#00713c" },
  { id: "maskan", bins: ["628023"], ibanCode: "014", color: "#00549f" },
  { id: "refah", bins: ["589463"], ibanCode: "013", color: "#00a0b0" },
  { id: "parsian", bins: ["622106", "639194", "627884"], ibanCode: "054", color: "#8c1d40" },
  { id: "pasargad", bins: ["639347", "502229"], ibanCode: "057", color: "#d4a017" },
  { id: "saman", bins: ["621986"], ibanCode: "056", color: "#0072bb" },
  { id: "eghtesadNovin", bins: ["627412"], ibanCode: "055", color: "#5b2d8e" },
  { id: "ansar", bins: ["627381"], ibanCode: "063", color: "#00695c" },
  { id: "postbank", bins: ["627760"], ibanCode: "021", color: "#00843d" },
  { id: "ayandeh", bins: ["636214"], ibanCode: "062", color: "#6a1b4d" },
  { id: "shahr", bins: ["502806", "504706"], ibanCode: "061", color: "#c8102e" },
  { id: "day", bins: ["502938"], ibanCode: "066", color: "#7a1fa2" },
  { id: "sina", bins: ["639346"], ibanCode: "059", color: "#00539b" },
  { id: "sarmayeh", bins: ["639607"], ibanCode: "058", color: "#1b5e20" },
  { id: "tosee", bins: ["628157"], ibanCode: "020", color: "#00558c" },
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

export function bankById(id: string | null | undefined): IranianBank | null {
  if (!id) return null;
  return IRANIAN_BANKS.find((b) => b.id === id) ?? null;
}

/**
 * Name the bank from a sheba alone.
 *
 * Positions 5–7 of an Iranian IBAN are the central bank's code for the issuing
 * bank, so an operator who pastes a sheba never has to also tell us which bank
 * it belongs to — and if they pick a different one from the list, we know the
 * two disagree before the money moves.
 */
export function bankFromSheba(input: string): IranianBank | null {
  const raw = input.replace(/[\s-]/g, "").toUpperCase();
  const iban = raw.startsWith("IR") ? raw : `IR${raw}`;
  if (!/^IR[0-9]{24}$/.test(iban)) return null;
  return IRANIAN_BANKS.find((b) => b.ibanCode === iban.slice(4, 7)) ?? null;
}
