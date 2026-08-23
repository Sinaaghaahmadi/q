import { CURRENCIES, type CurrencyCode } from "@/lib/rates/catalog";
import { localeTag, type Locale } from "@/i18n/routing";

/**
 * Every locale the app formats numbers and dates for.
 *
 * Kept as an alias of the routing `Locale` rather than its own list, so adding
 * a language cannot leave the formatter behind — which is exactly what would
 * have happened here: this file said `"fa" | "en"` while routing gained Arabic
 * and French, and every call site casts to it.
 */
export type AppLocale = Locale;

const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"] as const;

/**
 * Intl locale used for display formatting.
 *
 * fa-IR renders Persian digits and ar-AE renders Eastern Arabic ones (§18);
 * both are the digits those readers expect to see on a price. The tags live in
 * `@/i18n/routing` beside the locale list so the two cannot drift.
 */
function intlLocale(locale: AppLocale): string {
  return localeTag[locale] ?? "en-US";
}

/**
 * The one number formatter (§2.4: "never format numbers ad hoc").
 * Persian digits in fa display contexts; Latin digits belong in inputs and
 * machine-readable identifiers only.
 */
export function formatNumber(
  value: number,
  locale: AppLocale,
  options: Intl.NumberFormatOptions = {},
): string {
  if (!Number.isFinite(value)) return locale === "fa" ? "—" : "—";
  return new Intl.NumberFormat(intlLocale(locale), {
    maximumFractionDigits: 2,
    ...options,
  }).format(value);
}

/** Format an amount of a currency with its canonical decimals. */
export function formatAmount(value: number, currency: CurrencyCode, locale: AppLocale): string {
  const decimals = CURRENCIES[currency].decimals;
  return formatNumber(value, locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format a Toman rate figure. Rates below 1,000 Toman (IQD, AMD, …) keep one
 * decimal so day-to-day moves stay visible; larger figures are whole Toman.
 */
export function formatRate(tomans: number, locale: AppLocale): string {
  const digits = tomans >= 1000 ? 0 : tomans >= 10 ? 1 : 2;
  return formatNumber(tomans, locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

/** Signed percent chip text, always carrying an explicit sign (§2.3). */
export function formatChangePct(pct: number, locale: AppLocale): string {
  const abs = formatNumber(Math.abs(pct), locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const sign = pct > 0 ? "+" : pct < 0 ? "−" : "";
  const percent = locale === "fa" ? "٪" : "%";
  return `${sign}${abs}${percent}`;
}

export function toPersianDigits(input: string): string {
  return input.replace(/[0-9]/g, (d) => PERSIAN_DIGITS[Number(d)] ?? d);
}

/** Normalize Persian/Arabic-Indic digits to Latin — for parsing user input. */
export function toLatinDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

/**
 * Parse a human-typed amount: accepts Persian or Latin digits, group
 * separators, and either decimal mark. Returns null when not a number.
 */
export function parseAmountInput(raw: string): number | null {
  const normalized = toLatinDigits(raw)
    .replace(/[,٬  \s]/g, "")
    .replace(/[٫]/g, ".");
  if (normalized === "" || normalized === ".") return null;
  if (!/^\d*(\.\d*)?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/** Group an input string with Latin digits (inputs always use Latin, §18). */
export function formatAmountInput(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(value);
}

/** "x seconds/minutes ago" for the rate ticker. */
export function formatSecondsAgo(seconds: number, locale: AppLocale): string {
  const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: "always" });
  if (seconds < 60) return rtf.format(-Math.max(1, Math.round(seconds)), "second");
  if (seconds < 3600) return rtf.format(-Math.round(seconds / 60), "minute");
  return rtf.format(-Math.round(seconds / 3600), "hour");
}

/** Jalali date in fa, Gregorian elsewhere, each in its own language (§18). */
export function formatDate(
  date: Date | string,
  locale: AppLocale,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  // Persian keeps its own calendar as well as its own language — a date in fa
  // is 31 Mordad, not 22 August. Every other locale takes its own tag rather
  // than en-US, which is what this line used to hand German, French and Arabic
  // readers: a French administrator was being shown "Aug 22, 2026".
  const loc = locale === "fa" ? "fa-IR-u-ca-persian" : intlLocale(locale);
  return new Intl.DateTimeFormat(loc, options).format(d);
}

export function formatTime(date: Date | string, locale: AppLocale): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(intlLocale(locale), {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}
