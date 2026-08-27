import { chromium } from "@playwright/test";
const out = process.argv[2], pw = process.env.DEMO_PW;
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, deviceScaleFactor: 2, colorScheme: "light" });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));

await page.goto("http://localhost:3000/signin", { waitUntil: "networkidle" });
await page.getByText("کارکنان", { exact: true }).first().click();
await page.waitForTimeout(400);
await page.fill("#signin-email", "admin@asaex.demo");
await page.fill("#signin-password", pw);
const cb = page.getByRole("checkbox");
if (await cb.count()) await cb.first().check();
await page.getByTestId("signin-submit").click().catch(async () => {
  await page.getByRole("button", { name: /ادامه|ورود/ }).last().click();
});
await page.waitForTimeout(2500);
console.log("after submit:", page.url());
await page.screenshot({ path: `${out}/dbg-after-signin.png` });

for (const [name, path] of [["orders", "/orders"], ["profile", "/profile"]]) {
  const r = await page.goto("http://localhost:3000" + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  console.log(name, r?.status(), page.url());
  await page.screenshot({ path: `${out}/dbg-${name}.png` });
}
await browser.close();
console.log("errors:", errs.length ? errs : "none");
