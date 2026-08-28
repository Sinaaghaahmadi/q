import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { globSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "../..");

/**
 * A Server Component may not import a *value* from a `"use client"` module.
 *
 * The bundler replaces such a module with a client-reference proxy, so the
 * import arrives as something that is not the thing you exported: an array
 * becomes a proxy and `KYC_STATUSES.find is not a function` at request time.
 * TypeScript sees the declared type and says nothing, `next build` succeeds,
 * and the page 500s the first time somebody opens it — which is how both
 * `/admin/users` and `/admin/compliance` shipped broken.
 *
 * Types are fine (`import type` is erased), and so are components: rendering a
 * client component from a server one is the whole point of the boundary. What
 * is not fine is reaching through it for a constant or a function.
 */
const isClientModule = (file: string) =>
  /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*["']use client["']/.test(readFileSync(file, "utf8"));

/**
 * A component is PascalCase: an initial capital *and* a lowercase letter after
 * it. "Starts with a capital" is not enough — `KYC_STATUSES` starts with a
 * capital and is the exact constant that broke `/admin/users`.
 */
const looksLikeComponent = (name: string) => /^[A-Z][a-zA-Z0-9]*[a-z][a-zA-Z0-9]*$/.test(name);

function valueImports(source: string): { spec: string; names: string[] }[] {
  const out: { spec: string; names: string[] }[] = [];
  const re = /import\s+(type\s+)?\{([^}]*)\}\s*from\s*["'](@\/[^"']+)["']/g;
  for (const m of source.matchAll(re)) {
    if (m[1]) continue; // `import type { … }` — erased, always safe
    const names = m[2]!
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean)
      .filter((n) => !n.startsWith("type "))
      .map((n) => (n.split(/\s+as\s+/)[0] ?? "").trim())
      .filter(Boolean);
    if (names.length > 0) out.push({ spec: m[3]!, names });
  }
  return out;
}

function resolveAlias(spec: string): string | null {
  for (const ext of [".ts", ".tsx"]) {
    const path = resolve(ROOT, "src", spec.slice(2) + ext);
    try {
      readFileSync(path);
      return path;
    } catch {
      /* try the next extension */
    }
  }
  return null;
}

describe("server/client boundary", () => {
  it("no server file reaches through a client module for a value", () => {
    const files = globSync("src/app/**/*.tsx", { cwd: ROOT }).map((f) => resolve(ROOT, f));
    const offences: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      if (isClientModule(file)) continue; // client → client is fine

      for (const { spec, names } of valueImports(source)) {
        const target = resolveAlias(spec);
        if (!target || !isClientModule(target)) continue;
        const values = names.filter((n) => !looksLikeComponent(n));
        for (const name of values) {
          offences.push(`${relative(ROOT, file)} imports ${name} from ${spec} ("use client")`);
        }
      }
    }

    expect(offences).toEqual([]);
  });
});
