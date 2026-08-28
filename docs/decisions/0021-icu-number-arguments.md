# 0021 — A number in a sentence is `{n, number}`, never `{n}`

**Status:** accepted · Phase 9

## Context

Every number the app prints on its own goes through `formatNumber` in
`src/lib/money/format.ts`, which resolves `fa` to `fa-IR` and therefore renders
Persian digits (§2.4, §18). That rule was enforced everywhere except in one
place nobody thought to look: inside sentences.

next-intl messages are ICU MessageFormat, where `{count}` is a _simple
argument_ — the value is inserted with `String(value)` and no formatter is
consulted. So a Persian panel that said

```json
"liveOrders": "{count} سفارش در جریان"
```

rendered **`4 سفارش در جریان`**, with a Latin four, on every admin and office
screen that counted anything. `{count, number}` is the same message routed
through `Intl.NumberFormat` for the active locale, and renders `۴`.

This was found by reading the rendered DOM of `/admin/exchanges`, not by any
check — twenty-odd messages across the console, the office panel, the P2P board
and the sign-in errors were all quietly wrong in the primary market's language,
and the Latin digits sat directly beside Persian ones produced by `formatNumber`
on the same screen.

The opposite mistake is the same bug pointed the other way: passing an
already-formatted string into `{n, number}` prints **NaN**, because ICU asks
`Intl.NumberFormat` to format `"۵۱٬۱۵۰٬۰۰۰"`.

## Decision

A placeholder that receives a JavaScript number is written `{name, number}`.
A placeholder that receives a string — a currency code, an office name, an
amount already through `formatAmount` — stays untyped.

`{count, plural, …}` already formats `#` correctly and needs nothing added.

`scripts/check-messages.mjs`, which CI runs as `pnpm messages`, reads the call
sites and fails the build when a `format…()` result is passed into a
`{…, number}` placeholder. Only that direction is checked. The reverse cannot be
judged from the expression: `code` and `count` are both bare identifiers, and a
checker that guessed would either cry wolf on every currency code or teach
people to ignore it.

## Consequences

Counts read in Persian digits in Persian, and the NaN direction cannot reach a
browser. The untyped direction still relies on the author, so the rule is
written here and the failure it prevents is named: if a number appears in a
Persian sentence in Latin digits, the placeholder is missing `, number`.
