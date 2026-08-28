# 0017 — Derive conversation membership; never let a client assert it

**Status:** accepted · **Date:** 2026-08-22

## Context

§10 asks for three conversation types on one engine: order chat, P2P trade
chat, and support segmented into three queues. The tables for all of that
landed in 0005 with read policies. What was missing was the part that decides
_who is in a conversation and when it opens_ — which is where the product
requirements actually live, and where the security does too.

The obvious shape is a client that creates a conversation and adds
participants. It is also the shape where every interesting bug lives: a
customer adding themselves to somebody else's order chat, an exchange office
filing its ticket into the customer queue to jump it, a message marked as an
internal note by the person it is a note about.

## Decision

`conversations` and `conversation_participants` have **no INSERT policy at
all**. The only way into a conversation is one of two SECURITY DEFINER openers,
each of which derives the roster rather than accepting one.

`conversation_for_order` reads the order, refuses unless the caller is a party
to it, refuses until an office is actually looking at it, and then seats the
customer plus every current member of that office. It opens at `office_review`
— before acceptance, which §10.1 calls out explicitly: people must be able to
ask before they commit. Platform staff are deliberately _not_ seated; they read
through `is_platform_staff()` in the existing policy, so oversight never
silently adds a name to a customer's conversation.

`conversation_for_support` derives the segment from the caller's own seats —
office member, P2P participant, or customer — so the three admin queues stay
honest. The client cannot pick a queue, which means the queue always means what
the admin panel says it means.

`message_send` is the single write path. The insert policy would already accept
a direct insert from a participant, and that stays true; what the function adds
is the three things a client cannot be trusted with: `last_message_at`, the
compliance flags, and the rule that an internal note may only be written by the
office or platform staff — never by the customer it concerns.

Detection of off-platform settlement is a **flag, never a block**. Losing the
supervised flow is this business's real failure mode, so it is worth surfacing;
but a false positive must not stop a genuine conversation, and compliance would
rather read a noisy queue than a censored one.

## The bug that made the case

0005's read policy for `conversations` was:

```sql
using (... exists (
  select 1 from public.conversation_participants p
  where p.conversation_id = id and p.user_id = auth.uid()))
```

`conversation_participants` has its own `id`, so the unqualified `id` bound to
the **inner** table. Postgres stored it as `p.conversation_id = p.id` — a row's
foreign key compared to its own primary key, false for every row that will ever
exist. The policy silently collapsed to `is_platform_staff()`: every
conversation was invisible to the customer and the office who were in it, and
staff saw all of them.

Nothing caught it for two phases because nothing read the table. It also
disabled the internal-note branch of `messages_participant_read`, whose
subquery joins `conversations` — so the office's own notes were hidden from the
office, which is how it finally surfaced.

Two things follow, and both are now in place:

1. **Qualify every column in a policy subquery**, including ones that look
   unambiguous today. A column added to either table later can silently rebind
   an unqualified name, and a policy that fails open is loud while a policy that
   fails _closed_ is silent until someone needs it.
2. A pgTAP assertion scans every policy in the schema for a comparison of an
   alias to itself and fails on any hit. It found this one and no others.

## Consequences

- Adding a participant means adding a rule to an opener, not a call site. That
  is more friction than an insert policy and the right amount of it.
- Realtime works without any membership check in the client: Supabase applies
  the same RLS policy to every broadcast row, so a browser watching a
  conversation it cannot read is simply never sent one.
- Support conversations reuse the caller's open thread rather than opening a
  new one per message, so the queue is a list of people, not of sentences.
- The flags are computed once, at write time, and stored on the message. A
  later change to the patterns does not retroactively re-flag history — which
  is correct for an append-only table, and means the pattern list is itself a
  dated decision rather than a live filter.
