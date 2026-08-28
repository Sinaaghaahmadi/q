/**
 * The version in `package.json` and the one the app displays must agree.
 *
 * `src/lib/version.ts` hard-codes the number because the browser cannot read
 * `package.json`, and a hard-coded number is a number that goes stale. This is
 * the thing that notices.
 *
 *   node scripts/check-version.mjs
 */
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8")).version;
const source = readFileSync("src/lib/version.ts", "utf8");
const shown = /APP_VERSION = "([^"]+)"/.exec(source)?.[1];

if (pkg !== shown) {
  console.error(`  ✗ version drift — package.json ${pkg}, src/lib/version.ts ${shown ?? "?"}`);
  process.exit(1);
}
console.log(`  ✓ version ${pkg}`);
