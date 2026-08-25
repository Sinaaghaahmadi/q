/**
 * Catch a component function being passed across the server/client boundary.
 *
 * This has now cost three production 500s in this repository, each identical
 * and each discovered by opening the page:
 *
 *   Error: Functions cannot be passed directly to Client Components
 *
 * A lucide icon is a function. A Server Component may render one, and may hand
 * one to another Server Component, but the moment it puts one in a prop of a
 * `"use client"` component the render dies — and it dies at runtime, in
 * production, on one route. `tsc` is happy: the prop's type really is a
 * component. `next build` is happy: nothing renders during it.
 *
 * So: for every module that is NOT `"use client"`, find JSX attributes whose
 * value is a bare identifier imported from `lucide-react`, and check whether
 * the element receiving it resolves to a module that IS. That is the exact
 * shape of the bug and nothing else.
 *
 * The fix is always the same, and `PanelNavLink` documents it: pass the
 * rendered element (`icon={<Foo className="size-4" />}`) rather than the
 * component.
 *
 *   node scripts/check-client-boundary.mjs
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/*
 * Walk the tree rather than ask git.
 *
 * The first version used `git ls-files`, which lists only *tracked* files — so
 * a component added in the same change as the bug was invisible to the check,
 * and the check passed on the exact fault it was written to catch. Verified by
 * reintroducing that fault: it reported clean. A guard that does not guard is
 * worse than no guard, because it is also a reason not to look.
 */
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(path));
    else if (entry.name.endsWith(".tsx")) out.push(path);
  }
  return out;
}
const files = walk("src");

const source = new Map(files.map((f) => [f, readFileSync(f, "utf8")]));
const isClient = (file) => /^\s*["']use client["']/m.test(source.get(file) ?? "");

/** Resolve `@/components/x` or `./x` to a file we have. */
function resolveImport(fromFile, spec) {
  let base;
  if (spec.startsWith("@/")) base = resolve("src", spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(fromFile), spec);
  else return null;
  for (const ext of [".tsx", ".ts", "/index.tsx", "/index.ts"]) {
    const candidate = `${base}${ext}`.replace(`${process.cwd()}/`, "");
    if (source.has(candidate) || existsSync(candidate)) return candidate;
  }
  return null;
}

const problems = [];

for (const file of files) {
  const text = source.get(file);
  if (isClient(file)) continue;

  // Identifiers imported from lucide-react — the functions at risk.
  const icons = new Set();
  for (const m of text.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']lucide-react["']/g)) {
    for (const part of m[1].split(",")) {
      const name = part.replace(/\btype\b/, "").split(/\s+as\s+/).pop().trim();
      if (/^[A-Z]\w*$/.test(name)) icons.add(name);
    }
  }
  if (icons.size === 0) continue;

  // Where each locally-used component comes from.
  const origin = new Map();
  for (const m of text.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g)) {
    const target = resolveImport(file, m[2]);
    if (!target) continue;
    for (const part of m[1].split(",")) {
      const name = part.replace(/\btype\b/, "").split(/\s+as\s+/).pop().trim();
      if (/^[A-Z]\w*$/.test(name)) origin.set(name, target);
    }
  }

  // `<Component ... prop={Icon} ...>`
  for (const el of text.matchAll(/<([A-Z]\w*)((?:[^>]|\n)*?)\/?>/g)) {
    const [, component, attrs] = el;
    const target = origin.get(component);
    if (!target || !isClient(target)) continue;
    for (const attr of attrs.matchAll(/(\w+)=\{([A-Z]\w*)\}/g)) {
      if (!icons.has(attr[2])) continue;
      const line = text.slice(0, el.index).split("\n").length;
      problems.push(
        `  ${file}:${line}  <${component} ${attr[1]}={${attr[2]}}> — ` +
          `${component} is a client component; pass <${attr[2]} /> instead`,
      );
    }
  }
}

if (problems.length > 0) {
  console.error("\n  ✗ a component function crosses into a client component:\n");
  console.error(problems.join("\n"));
  console.error(
    "\n  These render fine in `next build` and 500 when the page is opened.\n" +
      "  Pass the rendered element — icon={<Foo className=\"size-4\" />} — not the component.\n",
  );
  process.exit(1);
}
console.log("  ✓ no component functions cross the client boundary");
