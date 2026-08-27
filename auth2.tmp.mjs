import { chromium } from "@playwright/test";
const out = process.argv[2], pw = process.env.DEMO_PW;
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, deviceScaleFactor: 2, colorScheme: "light" });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));

await page.goto("http://localhost:3000/signin", { waitUntil: "networkidle" });
await page.getByRole("tab", { name: "کارکنان" }).or(page.getByText("کارکنان", { exact: true })).first().click();
await page.waitForTimeout(500);
const boxes = await page.$$eval("input", (els) => els.map((e) => ({ type: e.type, id: e.id, name: e.name, ph: e.placeholder })));
console.log(JSON.stringify(boxes));
await page.screenshot({ path: `${out}/dbg-staff-tab.png` });
await browser.close();
console.log("errors:", errs.length ? errs : "none");
