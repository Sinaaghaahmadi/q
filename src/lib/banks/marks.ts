/**
 * A drawable mark for every Iranian bank.
 *
 * The brief asks for the bank list to carry icons, and the honest way to do
 * that is not to ship twenty bank logos: those are registered trademarks we
 * have no licence to redistribute, and at the 40px a picker renders them they
 * would be a row of smudges anyway.
 *
 * So each bank gets a mark drawn in our own vector language — one of ten
 * primitives, chosen to echo the geometry the bank actually uses (Melli's arch,
 * Sepah's shield, Mellat's rhombus, Maskan's roof) — tinted with the bank's own
 * colour. Ten shapes across twenty banks would collide, so shape and colour
 * carry the identity together, and no two banks share both.
 *
 * Pure data with no JSX, so a Server Component may import it (ADR 0019).
 */

/** Path data drawn on a 24×24 grid, stroked, never filled. */
export const BANK_MARKS = {
  /** A dome on two piers — Melli, Ansar. */
  arch: "M4 20V12a8 8 0 0 1 16 0v8M9 20v-7a3 3 0 0 1 6 0v7",
  /** A crest that narrows to a point — Sepah, Sarmayeh. */
  shield: "M12 3 20 6v6c0 4-3.5 7.3-8 9-4.5-1.7-8-5-8-9V6Z",
  /** A rhombus with an inner echo — Mellat, Eghtesad Novin. */
  diamond: "M12 3 21 12l-9 9-9-9Zm0 5 4 4-4 4-4-4Z",
  /** Two rising strokes — Tejarat, Postbank. */
  chevron: "M4 15l5-5 4 4 7-7M17 7h4v4",
  /** A ring with a satellite — Saderat, Ayandeh. */
  orbit: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 4.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z",
  /** A leaf on its stem — Keshavarzi, Tosee Ta'avon. */
  leaf: "M5 19c0-8 5-13 14-14 1 9-3 15-11 15H5Zm3-2c2-3 5-5 8-6",
  /** A pitched roof over a doorway — Maskan, Shahr. */
  roof: "M3 11 12 4l9 7M6 10v10h12V10M10 20v-5h4v5",
  /** A drop — Refah, Saman. */
  drop: "M12 3s6 6.5 6 10.5A6 6 0 0 1 6 13.5C6 9.5 12 3 12 3Z",
  /** A fluted column — Parsian, Sina. */
  pillar: "M5 5h14M7 5v14M12 5v14M17 5v14M4 19h16",
  /** An eight-point star — Pasargad, Day. */
  star: "M12 2.5 14 8l5.5-2-2 5.5 5.5 2-5.5 2 2 5.5L14 19l-2 5.5L10 19l-5.5 2 2-5.5L1 13.5l5.5-2-2-5.5L10 8Z",
} as const;

export type BankMarkId = keyof typeof BANK_MARKS;

/**
 * Which mark each bank wears.
 *
 * Kept apart from `IRANIAN_BANKS` on purpose: that list is validation data —
 * BINs and IBAN codes, things that are wrong or right — and this is a
 * presentation choice. A bank we cannot draw still validates.
 */
export const BANK_MARK_BY_ID: Record<string, BankMarkId> = {
  melli: "arch",
  sepah: "shield",
  mellat: "diamond",
  tejarat: "chevron",
  saderat: "orbit",
  keshavarzi: "leaf",
  maskan: "roof",
  refah: "drop",
  parsian: "pillar",
  pasargad: "star",
  saman: "drop",
  eghtesadNovin: "diamond",
  ansar: "arch",
  postbank: "chevron",
  ayandeh: "orbit",
  shahr: "roof",
  day: "star",
  sina: "pillar",
  sarmayeh: "shield",
  tosee: "leaf",
};

export function markFor(bankId: string | null | undefined): BankMarkId {
  if (!bankId) return "orbit";
  return BANK_MARK_BY_ID[bankId] ?? "orbit";
}
