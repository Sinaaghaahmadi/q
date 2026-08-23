import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["fa", "en", "ar", "fr"],
  defaultLocale: "fa",
  localePrefix: "as-needed",
  // `/` is always Persian — the primary market. Users switch manually and the
  // choice persists in the next-intl cookie; Accept-Language never redirects.
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];

export const localeDir: Record<Locale, "rtl" | "ltr"> = {
  fa: "rtl",
  ar: "rtl",
  en: "ltr",
  fr: "ltr",
};

/**
 * How each locale is named, in its own language.
 *
 * A switcher that lists "Persian / English / Arabic / French" in English is
 * useless to the person who cannot read English — which is the whole audience
 * for a language switcher.
 */
export const localeName: Record<Locale, string> = {
  fa: "فارسی",
  en: "English",
  ar: "العربية",
  fr: "Français",
};

/**
 * The BCP-47 tag used for number, date and relative-time formatting.
 *
 * Arabic is `ar-AE`, and the reason is the numbering system rather than the
 * country. ICU splits the Arabic locales: `ar-SA` and `ar-EG` render Arabic-
 * Indic digits (١٢٣), while `ar-AE`, `ar-MA` and bare `ar` render Latin ones.
 * A remittance app shows currency codes, IBANs and order references in Latin no
 * matter what, and mixing ١٢٣ into a screen full of those reads as two
 * different systems arguing. So: Latin throughout for Arabic, stated
 * explicitly. Persian keeps `fa-IR` and its own ۱۲۳, where the whole screen
 * agrees.
 *
 * French is `fr-FR` rather than bare `fr` so the thousands separator is the
 * narrow no-break space French actually uses, not fr-CA's convention.
 */
export const localeTag: Record<Locale, string> = {
  fa: "fa-IR",
  en: "en-US",
  ar: "ar-AE",
  fr: "fr-FR",
};
