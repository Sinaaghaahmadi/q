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

/**
 * Staff accounts the panel shots sign in as. Demo credentials, documented in
 * docs/runbook.md and on the launch checklist to be rotated — capturing the
 * panels means actually being inside them, and signing in through the real form
 * proves the sign-in works as a side effect.
 */
const STAFF: Record<string, { email: string; password: string }> = {
  admin: { email: "admin@asaex.demo", password: process.env.DEMO_PASSWORD ?? "AsaDemo!1404" },
  operator: { email: "operator@asaex.demo", password: process.env.DEMO_PASSWORD ?? "AsaDemo!1404" },
};

interface Shot {
  name: string;
  path: string;
  scheme: "dark" | "light";
  viewport: { width: number; height: number };
  fullPage?: boolean;
  settleMs?: number;
  /** Sign in as this staff account first. Omit for the public surfaces. */
  as?: keyof typeof STAFF;
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

  // ── The panels, signed in ────────────────────────────────────────────────
  {
    name: "office-today-fa-light-mobile",
    path: "/office",
    scheme: "light",
    viewport: { width: 390, height: 844 },
    fullPage: true,
    as: "operator",
  },
  {
    name: "office-today-fa-dark-desktop",
    path: "/office",
    scheme: "dark",
    viewport: { width: 1280, height: 900 },
    fullPage: true,
    as: "operator",
  },
  {
    name: "admin-dashboard-fa-light",
    path: "/admin",
    scheme: "light",
    viewport: { width: 1440, height: 1000 },
    fullPage: true,
    as: "admin",
  },
  {
    name: "admin-dashboard-en-dark",
    path: "/en/admin",
    scheme: "dark",
    viewport: { width: 1440, height: 1000 },
    fullPage: true,
    as: "admin",
  },
  {
    name: "admin-orders-fa-light",
    path: "/admin/orders",
    scheme: "light",
    viewport: { width: 1440, height: 900 },
    fullPage: true,
    as: "admin",
  },
  {
    name: "admin-exchanges-fa-light",
    path: "/admin/exchanges",
    scheme: "light",
    viewport: { width: 1440, height: 900 },
    fullPage: true,
    as: "admin",
  },
  {
    name: "admin-finance-fa-light",
    path: "/admin/finance",
    scheme: "light",
    viewport: { width: 1440, height: 900 },
    fullPage: true,
    as: "admin",
  },
  {
    name: "admin-users-fa-light",
    path: "/admin/users",
    scheme: "light",
    viewport: { width: 1440, height: 900 },
    fullPage: true,
    as: "admin",
  },
  {
    name: "office-requests-fa-light-mobile",
    path: "/office/requests",
    scheme: "light",
    viewport: { width: 390, height: 844 },
    fullPage: true,
    as: "operator",
  },
  {
    name: "office-reports-fa-light",
    path: "/office/reports",
    scheme: "light",
    viewport: { width: 1280, height: 900 },
    fullPage: true,
    as: "operator",
  },
];

/**
 * Sign in through the real staff form. Doing it via the UI rather than by
 * injecting a session is deliberate: if the login is broken the screenshots
 * fail loudly instead of quietly capturing a signed-out page.
 */
async function signIn(page: import("@playwright/test").Page, who: keyof typeof STAFF) {
  const account = STAFF[who];
  if (!account) throw new Error(`unknown staff account ${who}`);

  await page.goto(`${BASE}/signin`, { waitUntil: "load" });
  await page.getByRole("radio").last().click();
  await page.locator("#signin-email").fill(account.email);
  await page.locator("#signin-password").fill(account.password);
  await page.getByRole("button", { name: /.+/ }).last().click();
  await page.waitForURL((url) => !url.pathname.includes("/signin"), { timeout: 20_000 });
}

async function capture(browser: Browser, shot: Shot) {
  const context = await browser.newContext({
    viewport: shot.viewport,
    colorScheme: shot.scheme,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  if (shot.as) await signIn(page, shot.as);
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
