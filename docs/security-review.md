# Security review

Written at the end of Phase 7, against the posture §15 asks for. It records what
was checked and how, what it found, and — the part that matters most before
production — what has **not** been checked.

## Method

Three passes, all repeatable:

1. **Privilege sweep.** Every function in `public` is listed with
   `has_function_privilege('anon'|'authenticated', …, 'EXECUTE')`, which asserts
   the _effective_ privilege rather than the ACL text. This distinction is the
   whole reason ADR 0015 exists: `revoke … from anon, authenticated` never
   removes the `PUBLIC` grant Postgres creates with every function, so two
   migrations' worth of "hardening" had been a no-op. A pgTAP assertion holds
   the list, and every migration since re-runs the blanket revoke so a newly
   added function cannot leak by being forgotten.
2. **Role probes against the live database.** Each privileged path is exercised
   as a real `authenticated` role — `set local role authenticated` with the
   caller's JWT claims — and again as `anon`, inside a transaction that is
   rolled back. Running as the owner proves nothing: it is how 0011's probe
   missed that `set_order_public_ref` was not `SECURITY DEFINER`, which had
   silently broken every order insert.
3. **Policy shape review.** Every RLS policy expression is read back from
   `pg_policy` as Postgres stored it, not as it was written. That is how the
   `conversations_participant` bug surfaced (below).

## What it found

|                                                                                                                                                                                                                             |                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `assert_transition`, `post_order_funding`, `post_order_release` callable by `anon` over PostgREST — the first trusts a caller-supplied actor, the second and third wrote ledger rows with **no authorization check at all** | fixed in 0011, pinned by pgTAP (ADR 0015)                                               |
| `set_order_public_ref` not `SECURITY DEFINER`, so its inner `gen_public_ref()` call was checked against the invoker — every customer order insert failed                                                                    | fixed in 0012                                                                           |
| An administrator could `DELETE` an exchange office, taking its history with it: `offices_admin_write` is a `FOR ALL` policy                                                                                                 | `forbid_delete` triggers, 0014                                                          |
| Configuration changes made outside a function left no trace                                                                                                                                                                 | `audit_row` triggers on every config table, 0014                                        |
| Impersonation opened the office's data but not its actions — an impersonating superadmin resolved as `platform` and could press nothing                                                                                     | fixed in 0015 (ADR 0016)                                                                |
| `conversations_participant` compared an alias to itself (`p.conversation_id = p.id`) and was false for every row, collapsing to `is_platform_staff()`                                                                       | fixed in 0016; a pgTAP assertion now fails any policy with a self-comparison (ADR 0017) |
| A participant could mark their own message an internal note, hiding it from their own side                                                                                                                                  | write policy tightened, 0016                                                            |
| Contrast, `aria-prohibited-attr`, a dangling `aria-controls`, an unnamed `role="img"`                                                                                                                                       | fixed in Phase 7; 30 axe assertions in CI                                               |

## What holds now

- **No service-role key exists in the application** (ADR 0010). Server and
  browser both run on the publishable key under RLS; every privileged operation
  is a `SECURITY DEFINER` function that checks the caller itself. There is no
  credential to leak that would bypass a policy.
- **41 functions are reachable from the API, and each one deliberately.** Ten
  are open to `anon`: four read-only predicates the RLS policies themselves
  evaluate (`has_role`, `is_platform_staff`, `is_office_member`,
  `impersonating`), `otp_rate_check` because it runs before anyone is signed in,
  `order_public_status` because the tracking page is the point of it and it
  carries its own rate limit, and four pieces of public reference data the
  converter and the public pages read (`currency_scale`, `convert_minor`,
  `customer_tiers`, `cost_benchmark`). The other 31 are signed-in entry points
  that re-check the caller.

  Everything else is closed to both roles — every ledger posting
  (`post_order_funding`, `post_order_release`, `post_order_refund`),
  `assert_transition`, the audit writers (`audit_event`, `audit_row`,
  `actor_role_label`), the reference generator (`gen_public_ref`), the escrow
  router, the reputation recalculation and every trigger function. The list is
  regenerated by the sweep in the latest migration, so it cannot drift by
  omission.

- **Nothing is deleted.** `forbid_mutation` on the append-only tables
  (`order_events`, `ledger_entries`, `audit_log`, `p2p_ratings`) and
  `forbid_delete` on the soft-delete ones. `audit_log` has no INSERT policy, so
  only definer functions write it, and refuses UPDATE and DELETE outright.
- **Every money movement is double-entry** with a deferred per-transaction
  balance constraint, and a refund posts reversing entries rather than editing
  anything (ADR 0016).
- **CSP** derives the Supabase origin at build time and allows nothing else;
  an e2e test asserts the directive shape so a regression fails the build.
  `frame-ancestors 'none'`, HSTS, `X-Content-Type-Options`, referrer policy.
- **KYC documents** live in a private bucket behind 60-second signed URLs, every
  view is audited, and the reviewer's id is watermarked onto the image.
- **Four-eyes on KYC decisions** is enforced in `kyc_decide`, not in the UI.

## Not checked, and needed before production

These are honest gaps, not oversights deferred quietly:

1. **No penetration test.** Everything above is white-box review by the author
   of the code. An independent test is the single highest-value thing to buy
   before taking real money.
2. **TOTP 2FA for staff is specified (§15) and not built.** Platform and office
   roles currently authenticate with the same one-time-code flow as customers.
   This should block go-live for any account that can move money.
3. **No rate limit on the authenticated API surface.** `otp_rate_check` guards
   sign-in and `order_public_status` guards the tracking page; PostgREST itself
   is otherwise open to a signed-in caller hammering it. Supabase's own limits
   apply, and are not a substitute.
4. **Sanctions screening is a table, not a pipeline.** `sanctions_hits` exists;
   nothing populates it. §15 requires screening before go-live in this business.
5. **No secret scanning or dependency audit in CI.** `pnpm audit` and a secrets
   scanner are a one-line addition each and are not yet there.
6. **The `market_offset` P2P rate cannot be verified by the database** because
   nothing persists the tgju feed (ADR 0018). The counterparty and the escrow
   office both see the rate before committing, which is the same trust model as
   a brokered order — but a persisted feed would make it checkable.
7. **Anti-fraud signals (§17.23)** — device fingerprinting, impossible-travel,
   first-order manual review — are not built.
8. **Backups and restore have never been exercised.** Supabase takes them; a
   restore has not been tested, which means it does not count.

## Re-running the checks

```bash
pnpm test          # 55 unit tests, incl. the role matrix and the can() grants
pnpm test:e2e      # 46 e2e, incl. 30 WCAG 2.1 AA assertions and the CSP shape
pnpm budget        # performance budget per route
supabase test db   # 23 pgTAP assertions: RLS, privileges, the state machine
```
