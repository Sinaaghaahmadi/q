# 0009 — Home & rates: ISR + client refresh, not per-request SSR

**Decision.** `/` and `/rates` use ISR (`revalidate: 300`) for the server
paint, then TanStack Query refreshes from `/api/rates` (dynamic, 60 s server
cache) every 60 s with an honest "updated X ago" ticker. Realtime push
replaces polling when Supabase lands (Phase 3).

**Why.** Fast, cacheable LCP for the front door (§14 performance budget)
while the numbers on screen are live within a second of hydration. CI builds
use demo mode so prerendering never depends on the network.
