# 0003 — `/_design` served via rewrite

**Decision.** App Router reserves `_`-prefixed folders as private, so the
design system lives at `src/app/[locale]/design` and `next.config.ts`
rewrites `/_design`, `/fa/_design`, `/en/_design` onto it. The middleware
matcher excludes `_design` so the rewrite wins.

**Why.** Keeps the §17.20 contract (`/_design` works, verified by e2e) without
fighting the framework's directory conventions.
