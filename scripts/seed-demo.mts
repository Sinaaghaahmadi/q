/**
 * Seeded demo mode (§17.21).
 *
 * Two halves, either of which can run alone:
 *
 *  1. The rate generator — deterministic, in-process, anchored to live tgju
 *     observations from 2026-08-20. This is what `RATES_DEMO_MODE=true` serves,
 *     and it needs no database at all.
 *  2. The platform dataset in `supabase/seed/demo.sql` — two exchange offices,
 *     a compliance reviewer, three verified customers and orders across the
 *     state machine, applied with psql when `DATABASE_URL` is set. The script
 *     drives every office and every order through the real functions as the
 *     role that would press the button, so a clean run is an acceptance run.
 *
 * Applying it is idempotent: it does nothing if the demo offices already exist.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { FOREIGN_CODES } from "../src/lib/rates/catalog";
import { demoProvider } from "../src/lib/rates/providers/demo";

const quotes = await demoProvider.fetchRates([...FOREIGN_CODES]);
console.log(`✓ demo provider produced ${quotes.length} deterministic quotes, e.g.:`);
for (const q of quotes.slice(0, 5)) {
  console.log(
    `  ${q.pair.padEnd(8)} mid ${Math.round(q.mid).toLocaleString("en-US")} Toman  (${q.changePct24h.toFixed(2)}% 24h)`,
  );
}

const SEED_SQL = "supabase/seed/demo.sql";
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.log("\nDATABASE_URL is not set — skipping the platform dataset.");
  console.log(`Apply it later with:  psql "$DATABASE_URL" -f ${SEED_SQL}`);
} else if (!existsSync(SEED_SQL)) {
  console.error(`\n✗ ${SEED_SQL} is missing.`);
  process.exit(1);
} else {
  console.log(`\nApplying ${SEED_SQL}…`);
  try {
    // psql writes the seed's NOTICEs to stderr; inherit both so the counts show.
    execFileSync("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1", "-f", SEED_SQL], {
      stdio: "inherit",
    });
    console.log("✓ platform dataset applied");
  } catch {
    console.error("\n✗ psql failed. Is it installed, and does DATABASE_URL reach the database?");
    process.exit(1);
  }
}

console.log("\nRun the app fully offline on the generated rates with:");
console.log("  RATES_DEMO_MODE=true pnpm dev");
