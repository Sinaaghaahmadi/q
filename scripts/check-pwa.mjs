/**
 * Is this app installable? The half that can be answered without a phone.
 *
 *   node scripts/check-pwa.mjs [url]        # default http://localhost:3000
 *   pnpm pwa https://asaex.example
 *
 * Chrome offers "add to home screen" when six things hold. Five of them are
 * facts about what the origin serves, and this checks those over plain HTTP —
 * deterministically, against any origin, in about a second:
 *
 *   1. a secure origin (https, or localhost)
 *   2. a linked manifest that parses
 *   3. name/short_name, a start_url, and a standalone-ish display
 *   4. a 192px and a 512px icon that actually load
 *   5. a service worker script that serves and has a fetch handler
 *
 * The sixth — whether Chrome *decides* to fire `beforeinstallprompt` — depends
 * on engagement heuristics and cannot be observed here at all. It is also the
 * one thing a real phone settles in thirty seconds, so `docs/test-plan.md` has
 * the steps rather than this script pretending to.
 *
 * Why not ask Chromium directly: `Page.getInstallabilityErrors` is the check
 * behind Lighthouse's "installable" audit, and in headless it is a coin flip.
 * It answers correctly only on a context's first page, on a first uncontrolled
 * load, asked once and early — miss any of those and it reports `no-manifest`
 * for a page whose manifest fetches fine and whose `<link>` is in the DOM.
 * Four runs of the same script gave one pass and three failures. A check that
 * lies a quarter of the time is worse than no check.
 */
const base = process.argv[2] ?? "http://localhost:3000/";
const origin = new URL(base).origin;
const results = [];

function record(ok, label, detail = "") {
  results.push({ ok, label, detail });
}

async function head(path) {
  try {
    const response = await fetch(new URL(path, origin), { redirect: "follow" });
    return { ok: response.ok, status: response.status, type: response.headers.get("content-type") };
  } catch (error) {
    return { ok: false, status: 0, type: null, error: String(error) };
  }
}

// 1. secure origin
const { protocol, hostname } = new URL(origin);
const secure = protocol === "https:" || hostname === "localhost" || hostname === "127.0.0.1";
record(secure, "secure origin", `${protocol}//${hostname}`);

// 2. the document links a manifest, and it parses
const html = await fetch(base).then((r) => r.text());
const link = html.match(/<link[^>]+rel="manifest"[^>]+href="([^"]+)"/)?.[1] ?? null;
record(Boolean(link), "manifest linked from the page", link ?? "no <link rel=manifest>");

let manifest = null;
if (link) {
  const response = await fetch(new URL(link, origin));
  record(response.ok, "manifest responds", `${response.status} ${response.headers.get("content-type")}`);
  try {
    manifest = await response.json();
  } catch {
    record(false, "manifest is valid JSON");
  }
}

// 3. the fields Chrome insists on
if (manifest) {
  record(Boolean(manifest.name || manifest.short_name), "name", manifest.name ?? "—");
  record(Boolean(manifest.start_url), "start_url", manifest.start_url ?? "—");
  const display = manifest.display ?? "";
  record(
    ["standalone", "fullscreen", "minimal-ui"].includes(display),
    "display is app-like",
    display || "—",
  );

  // 4. the icons Chrome looks for, actually fetched
  const icons = manifest.icons ?? [];
  for (const size of ["192x192", "512x512"]) {
    const icon = icons.find((entry) => (entry.sizes ?? "").split(" ").includes(size));
    if (!icon) {
      record(false, `${size} icon declared`);
      continue;
    }
    const probe = await head(icon.src);
    record(probe.ok, `${size} icon loads`, `${icon.src} → ${probe.status}`);
  }
  const maskable = icons.some((entry) => (entry.purpose ?? "").includes("maskable"));
  record(maskable, "a maskable icon", maskable ? "" : "Android will letterbox the icon");
}

// 5. a service worker that serves and handles fetch
const sw = await fetch(new URL("/sw.js", origin));
record(sw.ok, "service worker responds", `${sw.status}`);
if (sw.ok) {
  const source = await sw.text();
  const handlesFetch = /addEventListener\(\s*["']fetch["']/.test(source);
  record(handlesFetch, "service worker handles fetch", handlesFetch ? "" : "Chrome requires one");
}

const width = Math.max(...results.map((r) => r.label.length));
for (const { ok, label, detail } of results) {
  console.log(`  ${ok ? "✓" : "✗"} ${label.padEnd(width)}  ${detail}`);
}

const failed = results.filter((r) => !r.ok);
console.log(
  failed.length === 0
    ? `\n✓ ${origin} serves everything Chrome needs to offer an install.\n  Whether it offers one is up to the browser — see docs/test-plan.md §17.`
    : `\n✗ ${failed.length} of ${results.length} checks failed — Chrome will not offer an install.`,
);
process.exit(failed.length === 0 ? 0 : 1);
