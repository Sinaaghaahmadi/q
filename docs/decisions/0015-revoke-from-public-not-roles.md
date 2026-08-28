# 0015 — Revoke EXECUTE from PUBLIC, not from anon and authenticated

**Status:** accepted · **Date:** 2026-08-21

## Context

Migration 0007 was written to close a Supabase linter finding: several
`SECURITY DEFINER` functions were callable over PostgREST. It did this with

```sql
revoke execute on function public.assert_transition(...) from anon, authenticated;
```

The linter kept reporting them. That was easy to read as linter noise. It was
not — the revoke had no effect at all.

Postgres grants `EXECUTE` to `PUBLIC` on every function at creation. `anon` and
`authenticated` hold the privilege _through_ `PUBLIC`, so revoking it from the
roles removes a grant they never had directly and leaves the inherited one
intact. The ACL tells you plainly once you look: `=X/postgres` — an empty
grantee is `PUBLIC`.

What stayed reachable with only the publishable key:

- **`assert_transition`** takes `p_actor` and `p_actor_role` as parameters and
  trusts them. A customer could move any order to any state the machine permits
  and write the `order_events` row attributing it to another person.
- **`post_order_funding` / `post_order_release`** write double-entry ledger rows
  with no authorization check at all, against any order id.
- **`ledger_account`** creates ledger accounts on demand.

These are `SECURITY DEFINER` precisely so they can cross the RLS boundary that
ADR 0010 makes the whole security model. Reachable from the API, they are that
model's bypass.

## Decision

Deny by default, then grant back. Migration 0011 loops over every function in
`public` and revokes from `public, anon, authenticated`, then issues explicit
grants for the short list a client is meant to call.

Two rules follow from it:

1. **Assert the effective privilege, not the ACL text.** The pgTAP suite checks
   `has_function_privilege('anon', oid, 'EXECUTE')` for every privileged
   function. That is the question the ACL only indirectly answers, and it is
   the one that was silently wrong for two migrations.
2. **A `SECURITY DEFINER` function that takes an actor as an argument must never
   be grantable.** `assert_transition` keeps that shape because the state
   machine genuinely needs a caller-supplied actor; the fix is that only
   `order_advance` and `order_claim` may call it, and they derive the actor from
   `auth.uid()`.

## Consequences

Trigger functions lose their grants too, which is correct and harmless:
Postgres does not check `EXECUTE` on a trigger function against the user running
the statement. The commit that introduced this verified it rather than assuming
— `handle_new_user`, `set_order_public_ref` and the deferred
`assert_txn_balanced` all still fire with every client grant removed.

New functions arrive with the `PUBLIC` grant again, so the revoke loop belongs
in any migration that adds one, and the pgTAP assertion is what catches a miss.
