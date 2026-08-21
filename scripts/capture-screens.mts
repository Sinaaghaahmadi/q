/**
 * Capture review screenshots (§22.4: /_design in Persian dark + English light,
 * plus the Phase-1 front door). Requires a running server:
 *   pnpm build && pnpm start   (or BASE_URL=… to point at a deployment)
 * Output directory follows OUT_DIR when set.
 *
 * BASE_URL can point at a deployment, but not from inside the agent sandbox:
 * its egress proxy resets Chromium's connections even though curl succeeds.
 * Output: artifacts/screens/*.png
 */
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, type Browser } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = process.env.OUT_DIR ?? resolve(import.meta.dirname, "../artifacts/screens");
mkdirSync(OUT, { recursive: true });

const executablePath = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";

interface Shot {
  name: string;
  path: string;
  scheme: "dark" | "light";
  viewport: { width: number; height: number };
  fullPage?: boolean;
  settleMs?: number;
}

const SHOTS: Shot[] = [
  {
    name: "home-fa-dark-mobile",
    path: "/",
    scheme: "dark",
    viewport: { width: 390, height: 844 },
    fullPage: true,
  },
  {
    name: "home-en-light-desktop",
    path: "/en",
    scheme: "light",
    viewport: { width: 1440, height: 900 },
    fullPage: true,
  },
  {
    name: "design-fa-dark",
    path: "/_design",
    scheme: "dark",
    viewport: { width: 1440, height: 900 },
    fullPage: true,
  },
  {
    name: "design-en-light",
    path: "/en/_design",
    scheme: "light",
    viewport: { width: 1440, height: 900 },
    fullPage: true,
  },
  {
    name: "rates-fa-light-mobile",
    path: "/rates",
    scheme: "light",
    viewport: { width: 390, height: 844 },
    fullPage: true,
  },
  {
    name: "transfer-fa-dark-mobile",
    path: "/transfer/new?from=USD&to=IRT&amount=1000",
    scheme: "dark",
    viewport: { width: 390, height: 844 },
    fullPage: true,
  },
  {
    name: "signin-fa-dark-mobile",
    path: "/signin",
    scheme: "dark",
    viewport: { width: 390, height: 844 },
    fullPage: true,
    settleMs: 1600,
  },
  {
    name: "signin-en-light-desktop",
    path: "/en/signin",
    scheme: "light",
    viewport: { width: 1280, height: 900 },
    settleMs: 1600,
  },
  {
    name: "scenes-fa-dark",
    path: "/_design#scenes",
    scheme: "dark",
    viewport: { width: 1280, height: 1400 },
    settleMs: 2400,
  },
];

async function capture(browser: Browser, shot: Shot) {
  const context = await browser.newContext({
    viewport: shot.viewport,
    colorScheme: shot.scheme,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  // Not `networkidle`: the rate views poll /api/rates on a timer, so against a
  // deployed site the network never goes quiet and the wait times out. Load,
  // then give the fonts and the entry animations a fixed moment to settle.
  await page.goto(`${BASE}${shot.path}`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(shot.settleMs ?? 1800);
  await page.screenshot({ path: resolve(OUT, `${shot.name}.png`), fullPage: shot.fullPage });
  await context.close();
  console.log(`✓ ${shot.name}`);
}

const browser = await chromium.launch(existsSync(executablePath) ? { executablePath } : undefined);
for (const shot of SHOTS) {
  await capture(browser, shot);
}
await browser.close();
console.log(`\nSaved to ${OUT}`);
