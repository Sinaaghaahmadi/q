# 0014 — Database types are hand-maintained type aliases

**Decision.** `src/lib/supabase/types.ts` declares the schema for the tables
and functions Phase 2 touches, using `type` aliases throughout — never
`interface`.

**Why the alias matters.** supabase-js checks the schema against
`Record<string, GenericTable>`. Only anonymous object types get the implicit
index signature that check needs; an `interface` fails it silently, the
`Schema` generic resolves to `never`, and every query result and insert
payload degrades to `never` with no error at the declaration site. The first
version of this file was written with interfaces and produced eighteen
confusing errors far from the cause.

**Consequences.** The file is maintained by hand until `supabase gen types
typescript` runs in CI; it stays small on purpose and covers exactly what the
app reads and writes.
