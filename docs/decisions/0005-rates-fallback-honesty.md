# 0005 — Rates failover & the meaning of `degraded`

**Decision.** Failover chain: tgju → last-good snapshot → seeded demo
provider; every fallback (and any observation older than 80 h) sets
`degraded: true`, which the UI must surface (warn chip naming the cause).
A closed Iranian market (Thu–Fri gap) is **not** degraded — the threshold is
sized to clear it — and the "updated X ago" ticker always shows fetch time.

**Why.** §7.1: never silently show a stale number; §17.21: every screen must
be reviewable offline/CI without the upstream. Demo data is deterministic
(seeded walk anchored to live 2026-08-20 observations) so SSR/CSR agree and
reviews are reproducible.
