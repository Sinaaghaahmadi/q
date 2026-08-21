import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { refreshSession } from "./lib/supabase/middleware";

const intlMiddleware = createMiddleware(routing);

/**
 * Locale routing first, then the auth session refresh writes its rotated
 * cookies onto the response next-intl produced.
 */
export default async function middleware(request: NextRequest) {
  const response = intlMiddleware(request);
  return await refreshSession(request, response);
}

export const config = {
  // `_design` is excluded so the next.config rewrite can serve it (§17.20).
  matcher: ["/((?!api|_next|_vercel|_design|.*\\..*).*)"],
};
