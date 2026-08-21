import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // `_design` is excluded so the next.config rewrite can serve it (§17.20).
  matcher: ["/((?!api|_next|_vercel|_design|.*\\..*).*)"],
};
