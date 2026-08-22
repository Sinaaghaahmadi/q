# 0016 — An administrator's override is wider, never quieter

**Status:** accepted · **Date:** 2026-08-22

## Context

§16 requires the super-admin panel to force any order transition, act on an
office's behalf, and correct the ledger. Each of those is, read plainly, a
request for a back door — a path that reaches past the rules everyone else
obeys. Built carelessly, they become exactly that: a second code path where the
role matrix does not apply, the timeline does not record, and the books can be
edited rather than corrected.

The alternative failure is just as real. If the override is so hemmed in that
ops cannot resolve a stuck order at 2am, they will resolve it in the database by
hand, which is the same back door with no audit trail at all.

## Decision

The overrides exist, and every one of them widens what a caller may do without
narrowing what gets recorded.

**Forcing a transition.** `order_force_transition` bypasses the role matrix and,
through `assert_transition`'s new `p_force` flag, the transition graph. It does
not bypass anything else. The state precondition, the optimistic-version check,
the `orders` update and the append-only `order_events` row all still happen, and
the event carries `meta.forced = true` with `actor_role = 'platform_force'`, so
a forced move reads differently from an ordinary one on the customer's own
timeline. Two limits survive the flag:

- **Terminal states are never departed.** A completed, cancelled, refunded,
  expired or SLA-breached order is corrected by a new compensating action, not
  by being rewound. Rewinding would leave the ledger describing a settlement
  that the order no longer claims happened.
- **A written reason of at least eight characters is an argument, not a field.**
  There is no call signature that omits it.

`p_force` defaults to false, so the seven-argument call sites in 0009 and 0012
are unchanged and the customer- and office-facing paths still cannot reach it.
The flag lives on `assert_transition` rather than in a parallel function because
a second copy of the state machine is precisely the drift this codebase keeps
finding.

**Refunding.** `post_order_refund` reverses the entries that were actually
posted for the order — direction flipped, amount and account preserved, memo
prefixed `reversal:` — rather than recomputing what they ought to have been. A
reversal of a balanced set balances by construction, it survives a later change
to the fee split that a recomputation would silently rewrite, and both halves
stay on the books, which is what makes a dispute answerable. Re-reversing is
refused outright.

**Impersonation.** A live row in `impersonations` _is_ the session: it carries
the reason, it expires on its own within four hours, and `is_office_member`
consults it. That last part is the design. Because the existing helper answers
yes, every office policy, every office screen and `order_actor_role` all admit
the administrator without a single one of them learning about impersonation —
so there is no weaker second path to walk down, and nothing to forget to update
when a policy is added. Actions taken while impersonating still record the
administrator's own `auth.uid()`: the office is the scope, never the identity.
Starting a session is restricted to `platform_superadmin`, which is who §5 names.

**Configuration.** Office provisioning and status changes go through SECURITY
DEFINER functions, but ordinary per-office edits — a spread, an account — write
straight to their tables under the FOR ALL policies that already existed. What
makes that safe to leave open is section B of 0014: `audit_row` triggers on
every configuration table, writing before/after diffs into an `audit_log` that
has no INSERT policy and refuses UPDATE and DELETE. You cannot change the
configuration without leaving a record, whichever door you came through.

## Consequences

- An administrator can resolve any stuck order, and cannot do it invisibly.
- `forbid_delete` triggers now cover `exchange_offices`, `office_accounts`,
  `office_rate_config`, `memberships`, `cms_content`, `feature_flags`, `orders`
  and `impersonations`. The FOR ALL policies that let an administrator configure
  an office had, until 0014, also let one erase its history.
- Reversal entries mean an order's ledger rows can outnumber its movements. Any
  report over `ledger_entries` has to net rather than sum, which is true of
  double-entry books generally and is now true here in practice.
- A four-hour ceiling on impersonation is arbitrary. It is short enough that a
  forgotten session closes itself the same working day and long enough for a
  real investigation; the ceiling lives in a table constraint, so moving it is a
  migration and therefore a decision.
