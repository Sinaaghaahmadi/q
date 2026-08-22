import { expect, test } from "@playwright/test";

test.describe("front door (§0.3): rates + converter before login", () => {
  test("Persian home is RTL with a working converter", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "fa");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("ارز، به سادگی آسا");

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
      "Currency, made effortless",
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

test("transfer quote itemizes fees (§7.2)", async ({ page }) => {
  await page.goto("/transfer/new?from=USD&to=IRT&amount=1000");
  await expect(page.getByText("کارمزد پلتفرم")).toBeVisible();
  await expect(page.getByText("کارمزد صرافی")).toBeVisible();
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

test("every authenticated route redirects a signed-out visitor to sign-in", async ({ page }) => {
  // This is the shape the Vercel deployment got wrong: with no Supabase values
  // at runtime the server decided auth was unconfigured and rendered the pages
  // instead of gating them. A 200 here means the gate is open.
  for (const path of ["/orders", "/profile", "/verify", "/accounts", "/admin/kyc", "/office"]) {
    const response = await page.goto(path);
    expect(response?.status(), `${path} should not render for a stranger`).toBe(200);
    await expect(page, `${path} should land on sign-in`).toHaveURL(
      new RegExp(`/signin\\?next=${path.replace(/\//g, "\\/")}`),
    );
  }
});
