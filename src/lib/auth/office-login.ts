/**
 * How an exchange office signs in.
 *
 * Offices use a username, not an email address: a currency-exchange clerk
 * should not need a mailbox to open the panel, and asking for one at
 * provisioning time is a question with no good answer for most shops.
 *
 * Supabase's password grant wants an email, so one is synthesised from the
 * username under a domain we control and never send mail to. The office never
 * sees it; the sign-in form takes the username and adds the rest.
 */
export const OFFICE_EMAIL_DOMAIN = "offices.asaex.ir";

/** A username the office will actually be able to type and dictate. */
export const OFFICE_USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,38}[a-z0-9]$/;

export function officeEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${OFFICE_EMAIL_DOMAIN}`;
}

/**
 * True when what someone typed into the sign-in field is a username rather
 * than an email address, so the form knows whether to append the domain.
 */
export function looksLikeUsername(input: string): boolean {
  const value = input.trim().toLowerCase();
  return !value.includes("@") && OFFICE_USERNAME_RE.test(value);
}

/** A username suggestion from an office's slug, so the field starts filled. */
export function suggestUsername(slug: string): string {
  const cleaned = slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/^[._-]+/, "")
    .replace(/[._-]+$/, "");
  return OFFICE_USERNAME_RE.test(cleaned) ? cleaned : "";
}
