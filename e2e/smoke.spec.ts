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
