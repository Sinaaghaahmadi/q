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
export const TERMS_VERSION = "1.0";

/**
 * The same number as the legal pages present it, per language.
 *
 * It used to carry "(draft)". These are the terms the service actually runs on
 * now, and a document that calls itself a draft while binding people is worse
 * than one that does not: it invites the reader to treat every clause as
 * provisional. What is still true — that counsel has not reviewed them in any
 * jurisdiction — is a launch-checklist item, not a label on the contract.
 */
export const TERMS_VERSION_LABEL = {
  fa: TERMS_VERSION,
  en: TERMS_VERSION,
} as const;

/** ISO date of the last substantive change. */
export const TERMS_UPDATED = "2026-08-24";
