import { expect, test, type Page } from "@playwright/test";

/**
 * The install offer, which nobody can see by looking.
 *
 * The card renders only after Chrome fires `beforeinstallprompt`, and Chrome
 * fires that on its own engagement heuristics — never in a headless run. So
 * the browser's *decision* cannot be tested here, and the two things around it
 * can:
 *
 * What is asserted here is the half that belongs in a test runner: given the
 * event, the card does the right thing with it.
 *
 * The other half — whether Chrome considers the app installable at all — lives
 * in `scripts/check-pwa.mjs`, because Chromium only answers that question in a
 * real profile, and Playwright hands every test an incognito context. Run it
 * against the deployed origin, where the answer actually matters:
 *
 *     node scripts/check-pwa.mjs https://asaex.example
 */
const CARD = "آسا را روی صفحهٔ اصلی بگذارید";

/** Hand the page the event Chrome would have sent, with a spy on `prompt()`. */
async function fireInstallPrompt(page: Page) {
  await page.evaluate(() => {
    (window as unknown as { __promptCalls: number }).__promptCalls = 0;
    const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: string }>;
    };
    event.prompt = async () => {
      (window as unknown as { __promptCalls: number }).__promptCalls += 1;
    };
    event.userChoice = Promise.resolve({ outcome: "accepted" });
    window.dispatchEvent(event);
  });
}

/**
 * The listener is attached in an effect, so the event has to arrive after
 * hydration — and "hydrated" is not something the page announces. Dispatching
 * until the card answers is the honest way to wait for it.
 */
async function offerInstall(page: Page) {
  await expect
    .poll(
      async () => {
        await fireInstallPrompt(page);
        return page.getByText(CARD).count();
      },
      { timeout: 15_000 },
    )
    .toBe(1);
}

const promptCalls = (page: Page) =>
  page.evaluate(() => (window as unknown as { __promptCalls: number }).__promptCalls);

test.describe("install offer (§14)", () => {
  test("the card appears on the event, installs, and stays gone", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(CARD)).toHaveCount(0);

    await offerInstall(page);
    await expect(page.getByText(CARD)).toBeVisible();

    await page.getByRole("button", { name: "افزودن به صفحهٔ اصلی" }).click();
    expect(await promptCalls(page)).toBe(1);
    await expect(page.getByText(CARD)).toHaveCount(0);

    // A suggestion that comes back is an advertisement.
    await page.goto("/");
    await fireInstallPrompt(page);
    await expect(page.getByText(CARD)).toHaveCount(0);
  });

  test("declining never reaches the browser prompt", async ({ page }) => {
    await page.goto("/");
    await offerInstall(page);

    await page.getByRole("button", { name: "نه، ممنون" }).click();
    expect(await promptCalls(page)).toBe(0);
    await expect(page.getByText(CARD)).toHaveCount(0);
  });
});
