# 0008 — `/` is always Persian; no Accept-Language detection

**Decision.** `localePrefix: "as-needed"` with `localeDetection: false`:
`/` always serves fa-IR (RTL), `/en/*` serves English, and a manual switch
persists via the next-intl cookie.

**Why.** The primary market reads Persian; an English browser locale (VPNs,
imported phones are common) must not silently flip the front door. Detection
also made `/` non-deterministic for caching, SEO, and review screenshots.
