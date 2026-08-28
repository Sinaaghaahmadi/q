import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "../..");

/**
 * Every item in a panel's menu must point at a page that exists.
 *
 * The office nav shipped with ten entries before nine of the pages did, so the
 * صراف's menu had holes in it — press "reports", get the not-found page. A nav
 * item is a promise, and this is the cheapest possible way to keep it: read the
 * hrefs out of the shell and look for the file the App Router would need.
 */
const SHELLS = ["src/components/admin/admin-shell.tsx", "src/components/office/office-shell.tsx"];

function hrefsOf(file: string): string[] {
  const source = readFileSync(resolve(ROOT, file), "utf8");
  return [...source.matchAll(/href:\s*"(\/[^"]*)"/g)].map((m) => m[1]!);
}

describe("panel navigation", () => {
  for (const shell of SHELLS) {
    it(`${shell} links only to routes that exist`, () => {
      const hrefs = hrefsOf(shell);
      expect(hrefs.length, "no nav hrefs found — did the shell change shape?").toBeGreaterThan(3);

      const missing = hrefs.filter(
        (href) => !existsSync(resolve(ROOT, `src/app/[locale]${href}/page.tsx`)),
      );
      expect(missing).toEqual([]);
    });
  }

  it("has no duplicate destinations", () => {
    for (const shell of SHELLS) {
      const hrefs = hrefsOf(shell);
      expect(new Set(hrefs).size, shell).toBe(hrefs.length);
    }
  });
});
