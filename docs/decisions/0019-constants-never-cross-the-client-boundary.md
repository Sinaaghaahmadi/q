# 0019 — A constant never crosses the client boundary

**Status:** accepted · Phase 8

## Context

`/admin/users` and `/admin/compliance` shipped and 500'd on first open:

```
TypeError: j.KYC_STATUSES.find is not a function
TypeError: j.THRESHOLD_KEYS is not iterable
```

Both pages are Server Components. Both imported an array constant that was
declared in — and exported from — the `"use client"` component they render.
The bundler does not give a Server Component the _value_ from a client module;
it replaces the module with a client-reference proxy. `KYC_STATUSES` arrives as
something that is not an array, and `.find` is not a function on it.

Nothing catches this before a browser does. TypeScript sees the declared type
and is satisfied. `next build` succeeds — it has no reason to object. Lint has
no rule for it. The page compiles, deploys, and dies at request time.

Two more instances were sitting in the same batch, and neither crashed:

- `/admin/rates` imported `SPREAD_BOUNDS_KEY` and used it as `.eq("key", …)`.
  A proxy in a query filter does not throw; the query just matches nothing, and
  the page renders a confident "no bounds recorded".
- `/admin/users/[id]` imported `ORDERS_SHOWN` / `LOGINS_SHOWN` and used them as
  `.limit(…)`.

The silent one is worse than the crash. A 500 gets fixed the day it is seen.

## Decision

A value shared between a page and the client component it renders lives in a
third module that is neither — `src/lib/**`, no `"use client"` directive. The
client component imports it like anything else.

Crossing the boundary the other way is unchanged and correct: a Server
Component rendering a client component, and passing it props, is the whole
point. What is banned is reaching _through_ the boundary for a constant or a
function.

`tests/unit/client-boundary.test.ts` enforces it: every file under `src/app`
that is not itself a client module is scanned for named value imports from a
`"use client"` module. Types are exempt — `import type` is erased before the
bundler sees it. Components are exempt, identified as PascalCase: an initial
capital _and_ a lowercase letter after it. That second condition matters —
`KYC_STATUSES` starts with a capital, and a naive "starts uppercase" rule
classified the exact constant that caused this as a component. The first
version of the test passed against the real bug.

## Consequences

- One more small module per page family. `src/lib/admin/filters.ts` is the
  first; it carries the four constants the four screens share.
- The test is a text scan, not a type-aware pass. A value re-exported through an
  intermediate module escapes it. That is a real gap, and worth widening only if
  it ever bites.
- A component whose name is genuinely all-caps would be flagged. There are none,
  and the fix is to name it properly.
