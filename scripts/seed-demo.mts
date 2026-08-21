/**
 * Seeded demo mode (§17.21), Phase 0/1 edition.
 *
 * There is no database yet — the demo dataset is generated deterministically
 * in-process by `src/lib/rates/providers/demo.ts` (anchored to live tgju
 * observations from 2026-08-20, seeded walk, stable across SSR/CSR). This
 * script just verifies the generator and prints how to run the app on it.
 * From Phase 2 on, this script grows into the full Supabase seeder
 * (customers, offices, orders in every state, chats, rate history).
 */
import { demoProvider } from "../src/lib/rates/providers/demo";
import { FOREIGN_CODES } from "../src/lib/rates/catalog";

const quotes = await demoProvider.fetchRates([...FOREIGN_CODES]);
console.log(`✓ demo provider produced ${quotes.length} deterministic quotes, e.g.:`);
for (const q of quotes.slice(0, 5)) {
  console.log(
    `  ${q.pair.padEnd(8)} mid ${Math.round(q.mid).toLocaleString("en-US")} Toman  (${q.changePct24h.toFixed(2)}% 24h)`,
  );
}
console.log("\nRun the app fully offline on this dataset with:");
console.log("  RATES_DEMO_MODE=true pnpm dev");
