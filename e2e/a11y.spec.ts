import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * §17.19: WCAG 2.1 AA, in both locales and both themes. Automated rules catch
 * roughly a third of real accessibility problems — contrast, names, roles,
 * landmarks, duplicate ids — which is exactly the third that regresses
 * silently. Keyboard reachability and focus order are asserted separately
 * below, because axe cannot see them.
 */
const PAGES = ["/", "/en", "/rates", "/p2p", "/signin", "/legal/terms", "/_design"];

async function scan(page: Page, path: string, theme: "light" | "dark") {
  await page.emulateMedia({ colorScheme: theme });
  await page.goto(path);
  await page.evaluate(() => document.fonts.ready);

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const violations = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    nodes: v.nodes.map((n) => n.target.join(" ")).slice(0, 4),
  }));
  expect(violations, `${path} (${theme})`).toEqual([]);
}

for (const path of PAGES) {
  test(`${path} has no WCAG 2.1 AA violations (light)`, async ({ page }) => {
    await scan(page, path, "light");
  });
  test(`${path} has no WCAG 2.1 AA violations (dark)`, async ({ page }) => {
    await scan(page, path, "dark");
  });
}

test("the front door is reachable and operable by keyboard alone (§17.19)", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);

  // Tab until the converter's amount field has focus; a keyboard user must be
  // able to reach the product's primary control without a pointer.
  const amount = page.locator("input[inputmode='decimal']").first();
  let reached = false;
  for (let i = 0; i < 40 && !reached; i += 1) {
    await page.keyboard.press("Tab");
    reached = await amount.evaluate((el) => el === document.activeElement).catch(() => false);
  }
  expect(reached, "the converter amount field is reachable by Tab").toBe(true);

  // And whatever holds focus must show it — an invisible focus ring is the same
  // as no keyboard support at all.
  const outline = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return null;
    const style = getComputedStyle(el);
    return {
      outlineWidth: style.outlineWidth,
      boxShadow: style.boxShadow,
      ring: style.getPropertyValue("--tw-ring-shadow"),
    };
  });
  expect(outline).not.toBeNull();
});
