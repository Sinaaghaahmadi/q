/**
 * The terms' version number, alone in its own file.
 *
 * Everything that *records* an acceptance needs this string and nothing else
 * from the legal corpus. `legal.ts` is six hundred lines of contract text in two
 * languages, and a client component that imported the version from it would
 * ship the whole thing into a panel bundle that is already measured against a
 * budget. So the number lives here and `legal.ts` imports it, not the reverse.
 *
 * Bump it whenever a clause changes. `settlement_acceptances.terms_version`
 * stores whatever this was at the moment someone accepted, which is the only
 * way to answer "what exactly did they agree to" a year later.
 */
export const TERMS_VERSION = "0.2";

/** The same number as the legal pages present it, per language. */
export const TERMS_VERSION_LABEL = {
  fa: `${TERMS_VERSION} (پیش‌نویس)`,
  en: `${TERMS_VERSION} (draft)`,
} as const;

/** ISO date of the last substantive change. */
export const TERMS_UPDATED = "2026-08-23";
