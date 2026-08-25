import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import withSerwistInit from "@serwist/next";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  // Keep the OCR engine out of the precache.
  //
  // It is five megabytes serving one optional step of one flow. Precaching it
  // would make every visitor — including everyone who never opens the verify
  // page — fetch it before the app shell is usable, which is the opposite of
  // what an offline shell is for.
  //
  // This is `globPublicPatterns`, not `exclude`: `exclude` filters webpack's
  // own assets, and files under `public/` never pass through it. The first
  // attempt used `exclude` and the built `sw.js` precached all four files
  // anyway — a silent no-op, caught by grepping the output rather than by
  // trusting the option name.
  //
  // The exclusion is written as an extglob rather than a `!` negation: the
  // plugin passes these straight to `glob`, which — unlike fast-glob — treats a
  // leading `!` inside a pattern as a literal and hardcodes its own `ignore`,
  // so `"!ocr/**"` was a second silent no-op. `"*"` keeps the top-level files.
  globPublicPatterns: ["!(ocr)/**", "*"],
});

// Financial-grade headers (§15). CSP uses 'unsafe-inline' for Next.js bootstrap
// scripts until nonce-based CSP lands (tracked in docs/decisions/0007).
//
// The browser talks to Supabase directly for RLS-guarded reads, KYC uploads and
// session refresh, and renders short-lived signed document URLs from Storage —
// so the project origin has to be allowlisted explicitly. When the URL is not
// set (CI, a fresh clone) we fall back to the provider-wide wildcard rather
// than silently shipping a policy that blocks every authenticated request.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : "https://*.supabase.co";
const supabaseSocket = supabaseOrigin.replace(/^https:/, "wss:");

const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabaseOrigin}`,
  "font-src 'self'",
  `connect-src 'self' ${supabaseOrigin} ${supabaseSocket}`,
  "manifest-src 'self'",
  "worker-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
];

const csp = cspDirectives.join("; ");

/**
 * The same policy, plus WebAssembly, for the one route that needs it.
 *
 * Reading a passport's machine-readable zone runs Tesseract compiled to Wasm,
 * and instantiating a Wasm module needs `'wasm-unsafe-eval'` in `script-src`.
 * Granting that site-wide would relax the policy on every screen that moves
 * money to buy a convenience on one, so it is granted to the four static engine
 * files under `/ocr/` and nowhere else — see `headers()` for why that is
 * sufficient. The engine is served from our own origin rather than a CDN, so
 * `default-src 'self'` still holds, and `worker-src` is untouched because the
 * worker is loaded from a same-origin path rather than the blob: URL the
 * library reaches for by default.
 *
 * ADR 0022 has the reasoning and what it would take to remove this again.
 */
const cspWithWasm = cspDirectives
  .map((directive) =>
    directive.startsWith("script-src ") ? `${directive} 'wasm-unsafe-eval'` : directive,
  )
  .join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  /*
   * A self-contained server directory, for the container.
   *
   * `standalone` traces exactly the files the built app imports and writes them
   * next to a minimal server, so the runtime image carries no `node_modules`
   * and no source. On this app that is the difference between shipping about a
   * gigabyte and shipping under two hundred megabytes — which matters a great
   * deal when the image is built on a server in Iran over a link that may be
   * fetching its base layers through a mirror.
   *
   * It changes nothing about how the app runs on Vercel, which ignores it.
   */
  output: "standalone",
  reactStrictMode: true,
  /**
   * Inline the publishable Supabase values at build time.
   *
   * Next loads `.env.production` when it builds, but hosts that bundle the
   * server as functions — Vercel among them — do not carry the file into the
   * runtime, so `process.env` came up empty there and the server decided
   * Supabase was unconfigured while the browser, which has these inlined
   * already, thought otherwise. Baking them in costs nothing: `NEXT_PUBLIC_`
   * values are build-time constants in the client bundle regardless, so a
   * change always meant a rebuild. A real environment variable still wins —
   * Next never overwrites an entry that is already set in `process.env`.
   */
  env: {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl ?? "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  },
  async headers() {
    // One CSP header per response, and the Wasm exception on the engine only.
    //
    // Two findings, both from reading real responses rather than the config.
    //
    // First, Next applies *every* matching entry, and a browser given two CSP
    // headers enforces their intersection — so adding a second, looser policy
    // on top of the site-wide one leaves Wasm blocked and nothing looks wrong.
    // `curl -D-` on /verify returned two `Content-Security-Policy` lines.
    //
    // Second, and the reason this ended up narrower than planned: the module is
    // compiled inside a Web Worker, and a dedicated worker takes its policy
    // from the headers of *its own script*, not from the page that started it.
    // Granting the page `'wasm-unsafe-eval'` changed nothing; the worker still
    // refused. So the exception belongs on `/ocr/*` — four static engine files
    // that render nothing and read nothing — and every page in the product,
    // /verify included, keeps the strict policy unchanged.
    const wasmHeaders = securityHeaders.map((header) =>
      header.key === "Content-Security-Policy" ? { ...header, value: cspWithWasm } : header,
    );
    return [
      { source: "/ocr/:file*", headers: wasmHeaders },
      { source: "/:path((?!ocr/).*)", headers: securityHeaders },
    ];
  },
  async rewrites() {
    // App Router reserves `_`-prefixed folders as private, so the public
    // `/_design` route (§17.20) is served by rewriting to the `design` segment.
    return [
      { source: "/_design", destination: "/fa/design" },
      { source: "/fa/_design", destination: "/fa/design" },
      { source: "/en/_design", destination: "/en/design" },
    ];
  },
};

export default withSerwist(withNextIntl(nextConfig));
