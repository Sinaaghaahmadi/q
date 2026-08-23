/**
 * Report what each locale is missing against English.
 *
 * Arabic and French are translated across the customer-facing surface; the
 * staff consoles are not, because the people in them are Iranian exchange
 * offices and Asaex staff working in Persian. `src/i18n/request.ts` layers
 * every locale over English so an untranslated key renders as readable English
 * rather than as `admin.rates.title`.
 *
 * That fallback is only defensible while somebody can see how big the gap is,
 * which is what this prints. It fails only when a *fully* translated locale
 * regresses — fa must match en exactly, because Persian is the primary market
 * and a missing Persian key is a bug, not a deferral.
 *
 *   node scripts/check-messages.mjs
 */
import { readFileSync } from "node:fs";

const LOCALES = ["fa", "en", "ar", "fr"];
/** Locales expected to be complete. A gap here is an error, not a note. */
const COMPLETE = ["fa"];

function leaves(node, trail = []) {
  const out = [];
  for (const [key, value] of Object.entries(node)) {
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      out.push(...leaves(value, [...trail, key]));
    } else {
      out.push([...trail, key].join("."));
    }
  }
  return out;
}

const catalogues = Object.fromEntries(
  LOCALES.map((l) => [l, JSON.parse(readFileSync(`src/messages/${l}.json`, "utf8"))]),
);

const english = new Set(leaves(catalogues.en));
let failed = false;

for (const locale of LOCALES) {
  if (locale === "en") continue;
  const own = new Set(leaves(catalogues[locale]));
  const missing = [...english].filter((k) => !own.has(k));
  const extra = [...own].filter((k) => !english.has(k));
  const pct = Math.round(((english.size - missing.length) / english.size) * 100);

  const mustBeComplete = COMPLETE.includes(locale);
  const mark = missing.length === 0 ? "✓" : mustBeComplete ? "✗" : "·";
  console.log(
    `  ${mark} ${locale}  ${pct}% — ${english.size - missing.length}/${english.size} keys` +
      (missing.length > 0 ? `, ${missing.length} fall back to English` : ""),
  );

  if (extra.length > 0) {
    console.error(`      ${extra.length} key(s) not in en: ${extra.slice(0, 5).join(", ")}`);
    failed = true;
  }
  if (mustBeComplete && missing.length > 0) {
    console.error(`      missing: ${missing.slice(0, 10).join(", ")}`);
    failed = true;
  }
}

if (failed) {
  console.error("\n✗ a locale that must be complete is not");
  process.exit(1);
}
console.log("\n✓ message catalogues consistent");
