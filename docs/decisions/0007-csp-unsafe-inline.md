# 0007 — CSP ships with 'unsafe-inline' script-src (temporary)

**Decision.** Full security-header set (HSTS preload, frame-ancestors none,
nosniff, referrer/permissions policies) ships now; `script-src` keeps
`'unsafe-inline'` because Next.js bootstrap inline scripts require either
that or per-request nonces.

**Why.** Nonce-based CSP forces full dynamic rendering (no SSG/ISR) and
touches every route; deferred to the Phase-7 security pass where it belongs,
tracked here so it is not forgotten. No third-party scripts exist, which
bounds the practical risk.
