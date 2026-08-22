/**
 * Performance budget (§20 Phase 7).
 *
 * A budget nobody measures is a wish. This reads the build's own manifest,
 * sums the unique JavaScript each route ships, and fails the build when a
 * route crosses its ceiling — so the number moves only when somebody decides
 * it should.
 *
 * The front door (§0.3: rates and the converter, before login) gets the tight
 * budget, because it is the page most people will ever see and the one most
 * likely to be opened on a slow connection. Signed-in surfaces carry editors,
 * tables and charts and are allowed more.
 *
 * Sizes are gzipped, because that is what crosses the wire and what Next's own
 * "First Load JS" column reports — measuring the unpacked bytes would overstate
 * everything by about 3× and make the budget meaningless.
 *
 *   node scripts/check-budget.mjs          # after `next build`
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const NEXT_DIR = ".next";
const KB = 1024;

/** route glob → ceiling in kB of first-load JavaScript. */
const BUDGETS = [
  { match: /^\/\[locale\]$/, limit: 215, label: "home (front door)" },
  { match: /^\/\[locale\]\/rates$/, limit: 215, label: "rates board" },
  { match: /^\/\[locale\]\/p2p$/, limit: 215, label: "p2p board" },
  { match: /^\/\[locale\]\/legal/, limit: 180, label: "legal pages" },
  { match: /.*/, limit: 290, label: "signed-in surfaces" },
];

const cache = new Map();
function sizeOf(file) {
  if (cache.has(file)) return cache.get(file);
  let size = 0;
  try {
    size = gzipSync(readFileSync(join(NEXT_DIR, file))).length;
  } catch {
    size = 0;
  }
  cache.set(file, size);
  return size;
}

const manifest = JSON.parse(readFileSync(join(NEXT_DIR, "app-build-manifest.json"), "utf8"));
const failures = [];
const rows = [];

for (const [route, files] of Object.entries(manifest.pages)) {
  if (route.endsWith("/route")) continue; // API handlers ship no client JS
  const page = route.replace(/\/page$/, "") || "/";
  const bytes = [...new Set(files)]
    .filter((f) => f.endsWith(".js"))
    .reduce((sum, f) => sum + sizeOf(f), 0);
  const kb = bytes / KB;

  const budget = BUDGETS.find((b) => b.match.test(page));
  rows.push({ page, kb, limit: budget.limit });
  if (kb > budget.limit) {
    failures.push(
      `${page} ships ${kb.toFixed(0)} kB, over the ${budget.limit} kB ${budget.label} budget`,
    );
  }
}

rows.sort((a, b) => b.kb - a.kb);
const FRONT = ["/[locale]", "/[locale]/rates", "/[locale]/p2p", "/[locale]/legal/[slug]"];
for (const row of [...rows.filter((r) => FRONT.includes(r.page)), ...rows.slice(0, 5)]) {
  const mark = row.kb > row.limit ? "✗" : "·";
  console.log(
    `  ${mark} ${row.page.padEnd(32)} ${row.kb.toFixed(0).padStart(4)} kB / ${row.limit} kB`,
  );
}

if (failures.length > 0) {
  console.error("\n✗ performance budget exceeded:");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`\n✓ ${rows.length} routes within budget`);
