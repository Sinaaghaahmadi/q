# 0018 — A P2P trade is an order, not a second settlement machine

**Status:** accepted · **Date:** 2026-08-22

## Context

§9 asks for a person-to-person marketplace, "a separate but architecturally
parallel flow", with matched trades routing "the Toman leg through a supervised
platform flow exactly as in §8, with an assigned office acting as the neutral
confirmer".

The obvious reading is a second flow: a `p2p_trades` state machine beside the
order one, its own funding and release, its own timeline. That reading is how
this goes wrong. Two settlement machines means two places money can be held,
two ledgers to reconcile during a dispute, two SLA clocks, and — the one that
actually bites — two sets of rules that drift apart at exactly the moment
somebody is angry about their money.

## Decision

**Taking an offer creates a real `orders` row.** `p2p_trade_take` writes the
trade, writes the order with `is_p2p = true` and `p2p_trade_id` set, and walks
it straight to `office_review` with the routed escrow office already attached.
From there every existing thing applies unchanged: `order_advance`, the role
matrix, `assert_transition`, the append-only timeline, the double-entry
postings, the SLA fields, the dispute state, the administrator's override.

The trade's own `state` is a **projection** of the order's, maintained by an
`after update of state` trigger. It cannot disagree with the order, because it
is not a second source of truth — it is a view of the first one with a
counterparty attached.

Three things genuinely differ, and only three:

1. **Who the counterparty is.** In a brokered transfer the office executes the
   foreign leg. In P2P the other person does, and the office _confirms_ it.
   That needed no change to the matrix: the office already drives the legs and
   the customer already confirms receipt.
2. **Where the released Toman goes.** `post_order_release` now credits the
   counterparty's payable rather than the office's settlement account when the
   order is P2P. The office takes its escrow fee and nothing else — crediting
   it the principal would be the platform quietly inventing a party to the
   trade.
3. **Who the order's customer is.** The machine in §8 is written from the Toman
   payer's point of view, so `p2p_trade_take` works out which side that is from
   the offer's currencies and makes them the customer. P2P does not get to bend
   the direction rule; it fits itself to it.

**Publishing goes through a function**, like conversations do (ADR 0017). §9's
requirements — a verified identity as a hard gate, the corridor rule, per-tier
ceilings, duplicate-offer detection, a posting cooldown — are not things a
client should be trusted to have applied, so `p2p_offers` lost its INSERT
policy and gained `p2p_offer_publish`.

**The database learned the currency scale.** §0.6 says amounts are minor units
and the scale comes from the catalog; until now that catalog existed only in
TypeScript, so Postgres could store minor units but could not convert between
two of them. A P2P trade has to derive one leg from the other, so
`public.currencies` and `convert_minor` exist now. A pgTAP assertion holds the
table to the client catalog.

## The honest limit

The database cannot verify a `market_offset` rate, because nothing persists the
tgju feed yet — §7.1's poller is meant to write `rate_snapshots` and the rates
service is still in-memory. So the agreed rate is a _proposal_: the counterparty
accepts it by taking the offer, and the escrow office sees it before accepting
the order.

That is not a new weakness — it is the same trust model as a brokered order,
whose draft also carries the rate the customer's client saw, and where the
office's acceptance is the check. But it is worth writing down rather than
implying the DB validates something it cannot. Persisting snapshots would let
`p2p_trade_take` check the rate against an observation it can see, and is the
named follow-up.

## Consequences

- A P2P order shows up in `/admin/orders`, in the office panel, in the ledger
  and in the audit trail with no special-casing anywhere. `/admin/p2p` is
  moderation and disputes only, because settlement has nowhere else to live.
- Reputation is derived, not accumulated: `p2p_refresh_reputation` recomputes
  completion rate and average release time from the trades and their orders'
  events. A counter would drift the first time a trade was corrected.
- `p2p_trade_dispute` goes through `assert_transition` as the platform rather
  than through the role matrix, because either principal may raise it and only
  one of them is the order's customer. The raiser is recorded in the audit row.
- The escrow office is chosen by `p2p_route_escrow` — active, covers the
  corridor, has a public Toman account, cheapest spread first. That is §17.7's
  smart routing in miniature, and the obvious place to add liquidity and
  scorecards later.
