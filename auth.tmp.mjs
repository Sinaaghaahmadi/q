import { chromium } from "@playwright/test";
const out = process.argv[2];
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, deviceScaleFactor: 2, colorScheme: "light" });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));

await page.goto("http://localhost:3000/signin", { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/dbg-signin.png` });

// what does the sign-in page offer?
const html = await page.content();
console.log("has password field:", html.includes('type="password"'));
console.log("tabs:", await page.$$eval("button, [role=tab]", (els) => els.map((e) => e.textContent.trim()).slice(0, 12)));
await browser.close();
console.log("errors:", errs.length ? errs : "none");
