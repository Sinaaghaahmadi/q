/**
 * Materialise the two variable webfonts `next/font/local` loads (§2.3).
 *
 *   node scripts/sync-fonts.mjs
 *
 * They are byte-identical to the files shipped inside the `vazirmatn` and
 * `@fontsource-variable/inter` packages, so the build copies them out of
 * node_modules instead of depending on a checkout that carries binaries.
 * Existing files are left alone — this never overwrites a deliberate swap.
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const FONTS = [
  {
    from: "node_modules/vazirmatn/fonts/webfonts/Vazirmatn[wght].woff2",
    to: "src/fonts/Vazirmatn-Variable.woff2",
  },
  {
    from: "node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
    to: "src/fonts/Inter-Variable.woff2",
  },
];

let copied = 0;
for (const font of FONTS) {
  const target = resolve(ROOT, font.to);
  if (existsSync(target)) continue;

  const source = resolve(ROOT, font.from);
  if (!existsSync(source)) {
    throw new Error(
      `Missing ${font.to} and its source ${font.from}. Run \`pnpm install\` first — ` +
        `the font packages are devDependencies.`,
    );
  }

  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
  copied += 1;
  console.log(`fonts: restored ${font.to}`);
}

if (copied === 0) console.log("fonts: already present");
