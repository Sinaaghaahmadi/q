import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

/**
 * Messages for the active locale, over an English base.
 *
 * Arabic and French are translated across the customer-facing surface; the
 * exchange-office and platform consoles are not, because the people in them are
 * Iranian offices and Asaex staff working in Persian. Rather than ship those
 * screens with raw keys showing, every locale is layered onto English, so an
 * untranslated key renders as readable English instead of `admin.rates.title`.
 *
 * This is a deliberate fallback, not a silent one: `scripts/check-messages.mjs`
 * reports what each locale is still missing, so the gap is measurable rather
 * than discovered by a user.
 */
function deepMerge(
  base: Record<string, unknown>,
  overlay: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    const existing = out[key];
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      existing !== null &&
      typeof existing === "object" &&
      !Array.isArray(existing)
    ) {
      out[key] = deepMerge(existing as Record<string, unknown>, value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  const english = (await import("../messages/en.json")).default as Record<string, unknown>;
  if (locale === "en") return { locale, messages: english };

  const own = (await import(`../messages/${locale}.json`)).default as Record<string, unknown>;
  return { locale, messages: deepMerge(english, own) };
});
