# 0020 — The platform sits above the office

**Status:** accepted · Phase 9

## Context

Asaex routes a customer's problem to the exchange office handling their
transfer, which is right: the office is the party that knows whether the money
was sent, and a platform relaying messages between the two adds a day and loses
detail.

But the arrangement has an obvious failure mode, and it is the one every
marketplace has: the office does not reply. Not maliciously — a small office
with three staff and a busy Thursday — and the customer is left holding a
question about their own money with no way to be heard. "Contact support" leads
back to the same office.

The tempting design is a support inbox the platform reads and forwards from.
That is a second queue, staffed by people with less context, and it makes the
office's silence somebody else's problem rather than a fact about the office.

## Decision

One queue, and the platform has authority over every row in it.

- A ticket about an order is routed to that order's office. They own the first
  answer.
- `ticket_set_state` admits three parties: the person who filed it, the office
  that owns it, and platform staff. Staff may act on **any** ticket without
  being a member of the office — `is_platform_staff()` is checked before, and
  independently of, `ticket_is_office_side()`.
- `ticket_escalate` moves a ticket to the platform. The office may call it to
  hand over something it cannot answer. Staff may call it at any time. And the
  **customer** may call it once the stated window — `settings.support_sla`,
  24 hours — has passed with no reply.

That last path is the decision. Everything else is ordinary support tooling;
letting the person who is waiting escalate without anybody's permission is what
makes the hierarchy real rather than a promise on a page. It is bounded rather
than open: the window must have elapsed, and a ticket somebody has already
answered cannot be escalated — the response clock stops on the first reply from
anyone other than the filer, so "nobody answered" means exactly that.

The same authority shape is why `/office/tickets` and `/admin/tickets` render
one component. `scope` changes which controls are drawn and the escalate label
("hand to platform" versus "take from office"); it changes nothing about what
is permitted. The database decides that, so a hidden button is a courtesy and
never a boundary. Two components would drift, and the one that drifts is
always the one that stops showing escalations.

## Consequences

- Platform staff can read every support ticket on the system. That is a real
  privacy surface, and it is the price of being able to act when an office
  will not. It is bounded by `is_platform_staff()` and every action is written
  to `ticket_events` with its actor.
- An office cannot prevent escalation, hide a ticket, or reset the clock. It
  can only answer.
- The 24-hour window is a `settings` row, not a constant, so it can be tightened
  without a migration — and per-office windows are a schema change away if
  offices ever need different commitments.
- `ticket_events` is append-only behind `forbid_mutation()`, including for
  staff. Nobody, at any level, can revise the record of who decided what.
