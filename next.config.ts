import type { NextConfig } from "next";

// STATIC_EXPORT=1 builds the serverless-free static demo (GitHub Pages);
// default build targets Vercel / self-hosted Node (standalone output).
const isStatic = process.env.STATIC_EXPORT === "1";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: isStatic ? "export" : "standalone",
  ...(basePath ? { basePath } : {}),
  ...(isStatic
    ? {}
    : {
        async headers() {
          return [
            {
              source: "/sw.js",
              headers: [
                { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
                { key: "Service-Worker-Allowed", value: "/" },
              ],
            },
            {
              source: "/:dir(fonts|icons)/:path*",
              headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
            },
          ];
        },
      }),
};

export default nextConfig;
