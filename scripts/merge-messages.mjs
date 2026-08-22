/**
 * Merge i18n fragments into the message catalogues.
 *
 * `src/messages/fa.json` and `en.json` are single files that everything reads,
 * which makes them the one thing a parallel build cannot share. So a page that
 * is built independently writes `src/messages/_frag/<name>.json`:
 *
 *   { "namespace": "admin.users", "fa": { … }, "en": { … } }
 *
 * and this folds each fragment in at its dotted path. Merging is deep and
 * additive; a fragment that would overwrite an existing leaf is refused rather
 * than silently winning, because two pages quietly disagreeing about a shared
 * key is a bug you find months later in the wrong language.
 *
 * `--take-fragment` relaxes exactly one half of that. A leaf the *catalogue*
 * already carried may be overwritten by a fragment, and every such overwrite is
 * printed. Two fragments disagreeing with each other in the same run is still
 * refused, and that is the case the guard was written for — the other one only
 * happens when a fragment's own earlier output reached the catalogue and the
 * fragment has since been corrected, where the fragment is by definition right.
 *
 *   node scripts/merge-messages.mjs [--prune] [--take-fragment]
 */
import { readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const FRAG_DIR = "src/messages/_frag";
const LOCALES = ["fa", "en"];
const prune = process.argv.includes("--prune");
const takeFragment = process.argv.includes("--take-fragment");

if (!existsSync(FRAG_DIR)) {
  console.log("no fragments to merge");
  process.exit(0);
}

const fragments = readdirSync(FRAG_DIR).filter((f) => f.endsWith(".json"));
if (fragments.length === 0) {
  console.log("no fragments to merge");
  process.exit(0);
}

const catalogues = Object.fromEntries(
  LOCALES.map((l) => [l, JSON.parse(readFileSync(`src/messages/${l}.json`, "utf8"))]),
);

const conflicts = [];
const overrides = [];
/** Dotted key → the fragment that wrote it this run, for fragment-vs-fragment. */
const written = new Map();

function descend(root, path) {
  let node = root;
  for (const key of path) {
    if (typeof node[key] !== "object" || node[key] === null || Array.isArray(node[key])) {
      node[key] = {};
    }
    node = node[key];
  }
  return node;
}

function mergeInto(target, source, trail, source_name, locale) {
  for (const [key, value] of Object.entries(source)) {
    const here = [...trail, key];
    const dotted = `${locale}:${here.join(".")}`;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      if (typeof target[key] !== "object" || target[key] === null) target[key] = {};
      mergeInto(target[key], value, here, source_name, locale);
    } else if (key in target && target[key] !== value) {
      const owner = written.get(dotted);
      if (owner) {
        conflicts.push(`${source_name} and ${owner} disagree about ${here.join(".")} (${locale})`);
      } else if (takeFragment) {
        overrides.push(`${here.join(".")} (${locale}) ← ${source_name}`);
        target[key] = value;
        written.set(dotted, source_name);
      } else {
        conflicts.push(
          `${source_name}: ${here.join(".")} already set to ${JSON.stringify(target[key])}`,
        );
      }
    } else {
      target[key] = value;
      written.set(dotted, source_name);
    }
  }
}

let merged = 0;
for (const file of fragments.sort()) {
  const raw = JSON.parse(readFileSync(join(FRAG_DIR, file), "utf8"));
  const namespace = String(raw.namespace ?? "").trim();
  if (!namespace) {
    conflicts.push(`${file}: missing "namespace"`);
    continue;
  }
  const path = namespace.split(".").filter(Boolean);
  for (const locale of LOCALES) {
    const block = raw[locale];
    if (!block || typeof block !== "object") {
      conflicts.push(`${file}: missing "${locale}" block`);
      continue;
    }
    mergeInto(descend(catalogues[locale], path), block, path, file, locale);
  }
  merged += 1;
  console.log(`  · ${file} → ${namespace}`);
}

// Both catalogues must describe the same shape, or one language silently shows
// raw keys where the other reads fine.
function shape(node, trail = []) {
  const out = [];
  for (const [key, value] of Object.entries(node)) {
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      out.push(...shape(value, [...trail, key]));
    } else {
      out.push([...trail, key].join("."));
    }
  }
  return out;
}
const fa = new Set(shape(catalogues.fa));
const en = new Set(shape(catalogues.en));
const onlyFa = [...fa].filter((k) => !en.has(k));
const onlyEn = [...en].filter((k) => !fa.has(k));

if (conflicts.length > 0) {
  console.error("\n✗ refused to merge:");
  for (const c of conflicts) console.error(`  - ${c}`);
  process.exit(1);
}
if (onlyFa.length > 0 || onlyEn.length > 0) {
  console.error("\n✗ the two catalogues disagree:");
  for (const k of onlyFa.slice(0, 20)) console.error(`  - only in fa: ${k}`);
  for (const k of onlyEn.slice(0, 20)) console.error(`  - only in en: ${k}`);
  process.exit(1);
}

for (const locale of LOCALES) {
  writeFileSync(`src/messages/${locale}.json`, `${JSON.stringify(catalogues[locale], null, 2)}\n`);
}
if (prune) rmSync(FRAG_DIR, { recursive: true, force: true });

if (overrides.length > 0) {
  console.log(`\n! ${overrides.length} catalogue leaves replaced by their fragment:`);
  for (const o of overrides) console.log(`  - ${o}`);
}
console.log(`\n✓ merged ${merged} fragments · ${fa.size} keys per locale`);
