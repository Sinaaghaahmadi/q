import { expect, test } from "@playwright/test";

test.describe("front door (§0.3): rates + converter before login", () => {
  test("Persian home is RTL with a working converter", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "fa");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("انتقال ارز، به سادگی");

    const amount = page.getByRole("textbox").first();
    await amount.fill("2500");
    // The recipient-gets figure renders Persian digits after the debounce.
    await expect(page.locator(".text-2xl.font-semibold").last()).toContainText(/[۰-۹]/, {
      timeout: 10_000,
    });
  });

  test("English home is LTR", async ({ page }) => {
    await page.goto("/en");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Currency transfer, made simple",
    );
  });
});

test("rates table lists the corridors", async ({ page }) => {
  await page.goto("/rates");
  await expect(page.getByText("USD", { exact: true })).toBeVisible();
  await expect(page.getByText("AED", { exact: true })).toBeVisible();
});

test("/_design rewrite serves the design system (§17.20)", async ({ page }) => {
  await page.goto("/_design");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("دیزاین‌سیستم");
  await page.goto("/en/_design");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("design system");
});

test("the quote states one commission, and the bands behind it", async ({ page }) => {
  // Asserting the arithmetic rather than just the label is the point — a fee
  // line that renders is not a fee line that is right. The figures follow
  // COMMISSION_BANDS (src/lib/rates/commission.ts); this test went stale once
  // already when the schedule dropped two rungs, so if it fails on a round
  // number, check the schedule before suspecting the calculator.
  await page.goto("/transfer/new?from=IRT&to=USD&amount=100000000");

  await expect(page.getByText("کارمزد صرافی")).toBeVisible();
  // 20M at 10% + 80M at 8% = 8,400,000. Persian digits, Persian grouping.
  await expect(page.getByText("۸٬۴۰۰٬۰۰۰", { exact: false })).toBeVisible();
  await expect(page.getByText("۸٫۴٪ از مبلغ حواله")).toBeVisible();

  // The two-line receipt is gone: what the office keeps and what the platform
  // keeps is a split of the figure above, not a second charge.
  await expect(page.getByText("کارمزد پلتفرم")).toHaveCount(0);

  await page.getByText("این درصد چطور حساب شد؟").click();
  const sheet = page.getByRole("dialog");
  // Exact: "۵٪" is a substring of "۶٫۵٪".
  await expect(sheet.getByText("۱۰٪", { exact: true })).toBeVisible();
  await expect(sheet.getByText("۵٪", { exact: true })).toBeVisible();
  await expect(sheet.getByText("کارمزد کل")).toBeVisible();
});

test("the quote can be edited where it is shown", async ({ page }) => {
  await page.goto("/transfer/new?from=IRT&to=USD&amount=100000000");
  await page.locator("#quote-amount").fill("500000000");
  // The edit rewrites the query string, which is what the server component
  // reads — the browser never computes a price of its own.
  await expect(page).toHaveURL(/amount=500000000/, { timeout: 10_000 });
  // 20M@10% + 80M@8% + 200M@6.5% + 200M@5% = 31.4M of 500M.
  await expect(page.getByText("۶٫۲۸٪ از مبلغ حواله")).toBeVisible();
});

test("rates API returns a snapshot", async ({ request }) => {
  const res = await request.get("/api/rates");
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { rates: Record<string, { mid: number }> };
  expect(body.rates["USD"]?.mid).toBeGreaterThan(0);
});

test("CSP allowlists the Supabase origin the browser actually calls (§15)", async ({ request }) => {
  // The KYC wizard uploads to Storage, the accounts manager and review queue
  // read through RLS, and reviewers render signed document URLs — all straight
  // from the browser. A `connect-src 'self'` policy silently breaks every one
  // of them, and only in production, so pin it here. The exact host depends on
  // which project the server was built against, so match the shape instead of
  // re-deriving it: this process does not see the server's env.
  const response = await request.get("/fa");
  const csp = response.headers()["content-security-policy"] ?? "";

  const directive = (name: string) =>
    csp
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name} `))
      ?.slice(name.length + 1)
      .split(/\s+/) ?? [];

  const connect = directive("connect-src");
  expect(connect).toContain("'self'");
  expect(connect.some((src) => /^https:\/\/[\w*.-]+\.supabase\.co$/.test(src))).toBe(true);
  expect(connect.some((src) => /^wss:\/\/[\w*.-]+\.supabase\.co$/.test(src))).toBe(true);

  const img = directive("img-src");
  expect(img).toEqual(expect.arrayContaining(["'self'", "data:", "blob:"]));
  expect(img.some((src) => /^https:\/\/[\w*.-]+\.supabase\.co$/.test(src))).toBe(true);

  expect(csp).toContain("frame-ancestors 'none'");
});

test("the Wasm exception reaches the OCR engine and nothing else (ADR 0022)", async ({
  request,
}) => {
  // Two ways this silently breaks, both seen while building it.
  //
  // One: Next applies every matching `headers()` entry, so a second, looser CSP
  // arrives as a *second* header and the browser enforces the intersection —
  // the page looks configured and Wasm is still refused. Count the headers, do
  // not just read the first.
  //
  // Two: the module is instantiated inside a Web Worker, which takes its policy
  // from its own script's headers rather than the page's. The exception belongs
  // on `/ocr/*`; if it ever drifts back onto a page, that page gains
  // `'wasm-unsafe-eval'` for nothing and this fails.
  const engine = await request.get("/ocr/worker.min.js");
  expect(engine.status()).toBe(200);
  const engineCsp = engine.headersArray().filter((h) => /^content-security-policy$/i.test(h.name));
  expect(engineCsp).toHaveLength(1);
  expect(engineCsp[0]?.value).toContain("'wasm-unsafe-eval'");

  for (const path of ["/fa", "/fa/verify", "/verify", "/fa/admin", "/fa/rates"]) {
    const response = await request.get(path);
    const headers = response
      .headersArray()
      .filter((h) => /^content-security-policy$/i.test(h.name));
    expect(headers, `${path} must carry exactly one CSP header`).toHaveLength(1);
    expect(headers[0]?.value, `${path} must not allow Wasm`).not.toContain("'wasm-unsafe-eval'");
  }
});

test("every authenticated route redirects a signed-out visitor to sign-in", async ({ page }) => {
  // This is the shape the Vercel deployment got wrong: with no Supabase values
  // at runtime the server decided auth was unconfigured and rendered the pages
  // instead of gating them. A 200 here means the gate is open.
  for (const path of [
    "/orders",
    "/profile",
    "/verify",
    "/accounts",
    "/office",
    "/support",
    "/p2p/new",
    "/admin",
    "/admin/kyc",
    "/admin/exchanges",
    "/admin/orders",
    "/admin/audit",
    "/admin/settings",
    "/admin/support",
    "/admin/p2p",
    "/admin/users",
    "/admin/compliance",
    "/admin/finance",
    "/admin/rates",
    "/admin/content",
    "/office/requests",
    "/office/chat",
    "/office/accounts",
    "/office/liquidity",
    "/office/rates",
    "/office/customers",
    "/office/team",
    "/office/reports",
    "/office/settings",
    "/office/settlement",
    "/office/coins",
    "/admin/settlement",
  ]) {
    const response = await page.goto(path);
    expect(response?.status(), `${path} should not render for a stranger`).toBe(200);
    await expect(page, `${path} should land on sign-in`).toHaveURL(
      new RegExp(`/signin\\?next=${path.replace(/\//g, "\\/")}`),
    );
  }
});
