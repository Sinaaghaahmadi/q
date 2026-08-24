/**
 * Every locale must match English, key for key.
 *
 * This used to be advisory: Persian had to be complete and the rest were
 * allowed to fall back, because the staff consoles were only ever going to be
 * read in Persian. They are all complete now — customer surface and both
 * consoles, in all five languages — and the moment that is true the check
 * becomes worth enforcing. A key added in English and not translated is a
 * screen that silently changes language mid-sentence for somebody, and the
 * cheapest place to notice is here rather than in the app.
 *
 * `src/i18n/request.ts` still layers every locale over English, so a gap
 * degrades to readable English instead of a raw key. That is a safety net, not
 * a licence: this check is what keeps it unused.
 *
 *   node scripts/check-messages.mjs
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const LOCALES = ["fa", "en", "ar", "fr", "de"];
/** Every locale is expected to be complete. A gap is an error, not a note. */
const COMPLETE = LOCALES;

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

// ─── A number that reaches ICU already formatted ─────────────────────────────
//
// `{n}` in ICU is plain substitution — it prints `4`, not `۴`, whatever the
// locale — so a count meant for a Persian reader has to be written `{n, number}`.
// The opposite mistake is worse and just as quiet: pass an already-formatted
// string ("۵۱٬۱۵۰٬۰۰۰") into `{n, number}` and the screen reads NaN.
//
// The call sites are read here rather than guessed at. Only the NaN direction
// fails the build: it is unambiguous, because a `format…()` call returns a
// string and nothing else does. The untyped direction cannot be judged from the
// expression alone — a currency code and a count look identical — so it is not
// checked, and `docs/decisions/0021-icu-number-arguments.md` records the rule.
const typedNumber = new Map();
(function collect(node, trail = []) {
  for (const [key, value] of Object.entries(node)) {
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      collect(value, [...trail, key]);
    } else if (typeof value === "string") {
      for (const match of value.matchAll(/\{\s*(\w+)\s*,\s*number/g)) {
        const leaf = trail.length ? key : key;
        if (!typedNumber.has(leaf)) typedNumber.set(leaf, new Set());
        typedNumber.get(leaf).add(match[1]);
      }
    }
  }
})(catalogues.fa);

const sources = execSync(
  "grep -rl 'useTranslations\\|getTranslations' src --include=*.tsx --include=*.ts",
  { encoding: "utf8" },
)
  .trim()
  .split("\n")
  .filter(Boolean);

const nanRisks = [];
for (const file of sources) {
  const src = readFileSync(file, "utf8");
  for (const call of src.matchAll(/\bt\w*\(\s*["'`]([\w.]+)["'`]\s*,\s*\{/g)) {
    const leaf = call[1].split(".").at(-1);
    const wants = typedNumber.get(leaf);
    if (!wants) continue;

    let depth = 1;
    let i = call.index + call[0].length;
    while (i < src.length && depth > 0) {
      if (src[i] === "{") depth += 1;
      else if (src[i] === "}") depth -= 1;
      i += 1;
    }
    const body = src.slice(call.index + call[0].length, i - 1);

    const parts = [];
    let nested = 0;
    let start = 0;
    for (let j = 0; j < body.length; j += 1) {
      const c = body[j];
      if ("{[(".includes(c)) nested += 1;
      else if ("}])".includes(c)) nested -= 1;
      else if (c === "," && nested === 0) {
        parts.push(body.slice(start, j));
        start = j + 1;
      }
    }
    parts.push(body.slice(start));

    for (const part of parts) {
      const [rawName, ...rest] = part.split(":");
      const name = rawName.trim();
      if (!/^\w+$/.test(name) || !wants.has(name)) continue;
      const expr = (rest.join(":") || name).trim();
      if (/format\w*\(|toFixed\(|toLocaleString\(/.test(expr)) {
        nanRisks.push(`      ${call[1]}.${name} in ${file} ← ${expr.slice(0, 60)}`);
      }
    }
  }
}

if (nanRisks.length > 0) {
  console.error(`\n  ✗ formatted string passed to a {…, number} placeholder — renders NaN:`);
  console.error(nanRisks.join("\n"));
  failed = true;
}

// ─── Placeholders must survive translation ───────────────────────────────────
//
// A translated string is a format string. Drop `{amount}` from the German and
// the sentence loses its number; invent `{amt}` and next-intl throws at render
// time, in that one locale, on that one screen — the kind of fault that reaches
// a user because nobody browses the app in every language.
//
// So every locale's placeholders are compared against English as a set. Rich
// tags (`<terms>…</terms>`) count too: they are supplied by the call site the
// same way, and a missing one is a link that silently disappears.
function placeholders(value) {
  const found = new Set();
  // `{name}` and `{name, number}` alike — the argument name is what matters.
  for (const m of value.matchAll(/\{\s*(\w+)\s*[,}]/g)) found.add(m[1]);
  for (const m of value.matchAll(/<(\w+)>/g)) found.add(`<${m[1]}>`);
  return found;
}

function flatten(node, trail = [], into = new Map()) {
  for (const [key, value] of Object.entries(node)) {
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      flatten(value, [...trail, key], into);
    } else if (typeof value === "string") {
      into.set([...trail, key].join("."), value);
    }
  }
  return into;
}

const englishStrings = flatten(catalogues.en);
const placeholderFaults = [];
for (const locale of LOCALES) {
  if (locale === "en") continue;
  for (const [key, value] of flatten(catalogues[locale])) {
    const source = englishStrings.get(key);
    if (source === undefined) continue;
    const want = placeholders(source);
    const got = placeholders(value);
    const missing = [...want].filter((p) => !got.has(p));
    const extra = [...got].filter((p) => !want.has(p));
    if (missing.length || extra.length) {
      placeholderFaults.push(
        `      ${locale} ${key}` +
          (missing.length ? ` — missing ${missing.join(", ")}` : "") +
          (extra.length ? ` — unknown ${extra.join(", ")}` : ""),
      );
    }
  }
}

if (placeholderFaults.length > 0) {
  console.error(`\n  ✗ placeholders differ from English — these render wrong or throw:`);
  console.error(placeholderFaults.slice(0, 40).join("\n"));
  if (placeholderFaults.length > 40) {
    console.error(`      … and ${placeholderFaults.length - 40} more`);
  }
  failed = true;
}

if (failed) {
  console.error("\n✗ message catalogues are not consistent");
  process.exit(1);
}
console.log("\n✓ message catalogues consistent");
