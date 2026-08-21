import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["fa", "en"],
  defaultLocale: "fa",
  localePrefix: "as-needed",
  // `/` is always Persian — the primary market. Users switch manually and the
  // choice persists in the next-intl cookie; Accept-Language never redirects.
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];

export const localeDir: Record<Locale, "rtl" | "ltr"> = {
  fa: "rtl",
  en: "ltr",
};
