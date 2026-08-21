import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import withSerwistInit from "@serwist/next";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
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

const csp = [
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
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
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
    return [{ source: "/(.*)", headers: securityHeaders }];
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
