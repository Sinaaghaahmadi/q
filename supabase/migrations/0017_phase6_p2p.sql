-- 0017 — Phase 6: the P2P marketplace (§9)
--
-- "A separate but architecturally parallel flow." Parallel is the whole design:
-- a matched P2P trade does not get its own settlement machine, it gets a real
-- `orders` row on the machine from §8, with an exchange office assigned as the
-- neutral confirmer. The Toman leg funds first into platform-supervised holding
-- and releases last, exactly as it does for a brokered transfer — which is what
-- makes P2P here safer than the Telegram groups it competes with, and what
-- keeps the ledger, the timeline, the SLA and the dispute path from having to
-- be written twice.
--
-- What is genuinely new is only: who the counterparty is (the other person,
-- not the office), where the released Toman goes (the maker, not the office),
-- and the anti-abuse rules §9 asks for.

-- ─────────────────────────────────────────────────────────────────────────────
-- A. The currency scale the database never had (§0.6)
--
-- "Money is never a float. Amounts are integer minor units + a currency code",
-- and the scale "comes from the catalog". Until now the catalog lived only in
-- TypeScript, so the database could store minor units but could not convert
-- between two of them — fine while every conversion happened in the client, and
-- not fine now that a P2P trade has to derive one leg from the other.
-- ─────────────────────────────────────────────────────────────────────────────

create table public.currencies (
  code text primary key,
  decimals int not null check (decimals between 0 and 4),
  created_at timestamptz not null default now()
);

insert into public.currencies (code, decimals) values
  ('IRT', 0),
  ('USD', 2),
  ('EUR', 2),
  ('GBP', 2),
  ('AED', 2),
  ('TRY', 2),
  ('IQD', 0),
  ('AZN', 2),
  ('AMD', 0),
  ('GEL', 2),
  ('RUB', 2),
  ('AFN', 0),
  ('PKR', 0),
  ('TMT', 2),
  ('OMR', 3),
  ('KWD', 3),
  ('QAR', 2),
  ('SAR', 2),
  ('CAD', 2),
  ('CNY', 2)
on conflict (code) do nothing;

alter table public.currencies enable row level security;
create policy currencies_public_read on public.currencies for select using (true);
create trigger t_currencies_no_delete before delete on public.currencies
  for each row execute function public.forbid_delete();

create or replace function public.currency_scale(p_code text)
returns int language sql stable set search_path = public as $$
  select decimals from public.currencies where code = upper(btrim(p_code));
$$;

/**
 * Convert an amount of `p_from` into `p_to` at `p_rate`, where the rate is
 * always quoted as Toman per one major unit of the foreign currency. Rounds
 * once, at the boundary, exactly as `toMinor` does in the client.
 */
create or replace function public.convert_minor(
  p_amount_minor bigint, p_from text, p_to text, p_rate numeric
) returns bigint language plpgsql stable set search_path = public as $$
declare
  v_from int := public.currency_scale(p_from);
  v_to int := public.currency_scale(p_to);
  v_major numeric;
begin
  if v_from is null then raise exception 'unknown currency %', p_from; end if;
  if v_to is null then raise exception 'unknown currency %', p_to; end if;
  if p_rate is null or p_rate <= 0 then raise exception 'rate must be positive'; end if;

  v_major := p_amount_minor::numeric / (10::numeric ^ v_from);
  -- IRT is one side of every Phase-1 corridor (§1), so the rate multiplies
  -- going to Toman and divides coming back.
  if upper(p_to) = 'IRT' then
    return round(v_major * p_rate * (10::numeric ^ v_to))::bigint;
  else
    return round(v_major / p_rate * (10::numeric ^ v_to))::bigint;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- B. Limits and anti-abuse (§9)
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.settings (key, value) values (
  'p2p_limits',
  jsonb_build_object(
    'max_open_offers', 5,
    'offers_per_hour', 5,
    -- Ceiling on a single trade, in Toman, by KYC risk tier.
    'tier_max_irt', jsonb_build_object('0', 200000000, '1', 1000000000, '2', 5000000000)
  )
) on conflict (key) do nothing;

create or replace function public.p2p_limits()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select value from public.settings where key = 'p2p_limits'), '{}'::jsonb);
$$;

/** The Toman ceiling for one trade at this user's KYC tier. */
create or replace function public.p2p_tier_ceiling(p_user uuid)
returns bigint language sql stable security definer set search_path = public as $$
  select coalesce(
    (public.p2p_limits() -> 'tier_max_irt' ->> (
      coalesce((select risk_tier from public.profiles where id = p_user), 0)::text
    ))::bigint,
    200000000
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- C. Offers
--
-- Publishing goes through a function for the same reason conversations do
-- (ADR 0017): the rules that matter — verified identity, the corridor rule, the
-- tier ceiling, no duplicate board spam — are not things a client should be
-- trusted to have applied. 0004's direct INSERT policy is dropped with it.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.p2p_offer_publish(p_payload jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_have text := upper(btrim(coalesce(p_payload->>'have_currency', '')));
  v_want text := upper(btrim(coalesce(p_payload->>'want_currency', '')));
  v_amount bigint := (p_payload->>'amount_minor')::bigint;
  v_mode text := coalesce(nullif(btrim(coalesce(p_payload->>'rate_mode', '')), ''), 'fixed');
  v_rate numeric := (p_payload->>'rate_value')::numeric;
  v_limits jsonb := public.p2p_limits();
  v_irt bigint;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  -- §9: "KYC-verified is a hard requirement to post or take an offer."
  if (select kyc_status from public.profiles where id = auth.uid()) is distinct from 'approved' then
    raise exception 'identity must be verified before posting an offer';
  end if;

  if public.currency_scale(v_have) is null or public.currency_scale(v_want) is null then
    raise exception 'unknown currency';
  end if;
  if v_have = v_want then raise exception 'the two legs must differ'; end if;
  -- Phase 1 corridor rule (§1): one leg is always Toman.
  if v_have <> 'IRT' and v_want <> 'IRT' then
    raise exception 'one leg of an offer must be Toman';
  end if;
  if v_amount is null or v_amount <= 0 then raise exception 'amount must be positive'; end if;
  if v_mode not in ('fixed','market_offset') then raise exception 'unknown rate mode %', v_mode; end if;
  if v_rate is null or v_rate <= 0 then raise exception 'rate must be positive'; end if;

  v_irt := case when v_have = 'IRT' then v_amount
                else public.convert_minor(v_amount, v_have, 'IRT', v_rate) end;
  if v_irt > public.p2p_tier_ceiling(auth.uid()) then
    raise exception 'that amount is above the ceiling for your verification tier';
  end if;

  if (select count(*) from public.p2p_offers
       where user_id = auth.uid() and status = 'open' and deleted_at is null)
     >= coalesce((v_limits->>'max_open_offers')::int, 5) then
    raise exception 'you already have the maximum number of open offers';
  end if;
  if (select count(*) from public.p2p_offers
       where user_id = auth.uid() and created_at > now() - interval '1 hour')
     >= coalesce((v_limits->>'offers_per_hour')::int, 5) then
    raise exception 'too many offers in the last hour; try again later';
  end if;
  -- Duplicate-offer detection (§9): the same pair twice is board spam, not
  -- liquidity. Editing the open one is the intended move.
  if exists (
    select 1 from public.p2p_offers
     where user_id = auth.uid() and status = 'open' and deleted_at is null
       and have_currency = v_have and want_currency = v_want
  ) then
    raise exception 'you already have an open offer for that pair';
  end if;

  insert into public.p2p_offers (
    user_id, side, have_currency, want_currency, amount_minor,
    min_slice_minor, max_slice_minor, rate_mode, rate_value, terms, expires_at, status
  ) values (
    auth.uid(),
    case when v_have = 'IRT' then 'want' else 'have' end,
    v_have, v_want, v_amount,
    nullif(btrim(coalesce(p_payload->>'min_slice_minor', '')), '')::bigint,
    nullif(btrim(coalesce(p_payload->>'max_slice_minor', '')), '')::bigint,
    v_mode, v_rate,
    nullif(btrim(coalesce(p_payload->>'terms', '')), ''),
    coalesce(nullif(btrim(coalesce(p_payload->>'expires_at', '')), '')::timestamptz,
             now() + interval '7 days'),
    'open'
  ) returning id into v_id;

  perform public.audit_event('p2p.offer_publish', 'p2p_offers', v_id, null,
    jsonb_build_object('pair', v_have || '/' || v_want, 'amount_minor', v_amount), null);
  return v_id;
end $$;

create or replace function public.p2p_offer_close(p_offer uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_status text;
begin
  select user_id, status into v_owner, v_status from public.p2p_offers where id = p_offer;
  if v_owner is null then raise exception 'offer not found'; end if;

  -- Moderation (§9) is a platform action, so it is separated in the trail.
  if v_owner <> auth.uid() and not public.is_platform_staff() then
    raise exception 'not your offer';
  end if;
  if v_status <> 'open' then raise exception 'that offer is already %', v_status; end if;

  update public.p2p_offers
     set status = case when v_owner = auth.uid() then 'cancelled' else 'removed' end
   where id = p_offer;

  perform public.audit_event(
    case when v_owner = auth.uid() then 'p2p.offer_cancel' else 'p2p.offer_remove' end,
    'p2p_offers', p_offer, jsonb_build_object('status', v_status), null, p_reason);
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- D. Taking an offer: the trade, and the order that carries it
--
-- §9's core claim is that a matched trade "routes the Toman leg through a
-- supervised platform flow exactly as in §8, with an assigned office acting as
-- the neutral confirmer". So this creates a real order and hands it to an
-- office at `office_review`, and from that moment the office panel, the
-- timeline, the ledger and the dispute path are the ones already built.
--
-- One honest limit, worth stating rather than hiding: the DB cannot verify a
-- `market_offset` rate, because nothing persists the tgju feed yet (§7.1's
-- poller writes `rate_snapshots`; the service is still in-memory). The agreed
-- rate is therefore a *proposal* that the counterparty accepts by taking, and
-- the escrow office sees before it accepts. That is the same trust model as a
-- brokered order, where the customer's draft also carries the rate it saw.
-- Persisting snapshots would let `p2p_trade_take` check it, and is the named
-- follow-up.
-- ─────────────────────────────────────────────────────────────────────────────

/**
 * The office best placed to escrow this corridor: active, configured for it,
 * cheapest spread first. §17.7's smart routing in miniature — enough to make
 * the flow work, and the obvious place to add liquidity and scorecards later.
 */
create or replace function public.p2p_route_escrow(p_corridor text)
returns uuid language sql stable security definer set search_path = public as $$
  select c.office_id
    from public.office_rate_config c
    join public.exchange_offices e on e.id = c.office_id
   where c.corridor = upper(p_corridor)
     and c.active and c.deleted_at is null
     and e.status = 'active' and e.deleted_at is null
     and exists (
       select 1 from public.office_accounts a
       where a.office_id = e.id and a.currency = 'IRT'
         and a.is_public and a.active and a.deleted_at is null
     )
   order by c.spread_bps, e.created_at
   limit 1;
$$;

create or replace function public.p2p_trade_take(
  p_offer uuid,
  p_amount_minor bigint,
  p_agreed_rate numeric
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  o public.p2p_offers%rowtype;
  v_trade uuid;
  v_order uuid;
  v_taken bigint;
  v_foreign text;
  v_corridor text;
  v_office uuid;
  v_irt_minor bigint;
  v_foreign_minor bigint;
  v_irt_payer uuid;
  v_platform_fee bigint;
  v_office_fee bigint;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if (select kyc_status from public.profiles where id = auth.uid()) is distinct from 'approved' then
    raise exception 'identity must be verified before taking an offer';
  end if;

  select * into o from public.p2p_offers where id = p_offer for update;
  if o.id is null then raise exception 'offer not found'; end if;
  if o.user_id = auth.uid() then raise exception 'you cannot take your own offer'; end if;
  if o.status <> 'open' then raise exception 'that offer is %', o.status; end if;
  if o.expires_at is not null and o.expires_at <= now() then
    raise exception 'that offer has expired';
  end if;
  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'amount must be positive';
  end if;
  if o.min_slice_minor is not null and p_amount_minor < o.min_slice_minor then
    raise exception 'below the minimum slice for this offer';
  end if;
  if o.max_slice_minor is not null and p_amount_minor > o.max_slice_minor then
    raise exception 'above the maximum slice for this offer';
  end if;

  select coalesce(sum(amount_minor), 0) into v_taken
    from public.p2p_trades
   where offer_id = p_offer and state not in ('cancelled','expired') and deleted_at is null;
  if v_taken + p_amount_minor > o.amount_minor then
    raise exception 'only % left on this offer', o.amount_minor - v_taken;
  end if;

  -- Which side is Toman decides who the order's customer is: the machine in §8
  -- is written from the Toman payer's point of view, and P2P does not get to
  -- bend it.
  v_foreign := case when o.have_currency = 'IRT' then o.want_currency else o.have_currency end;
  v_corridor := v_foreign || '-IRT';

  if o.have_currency = 'IRT' then
    -- The maker holds Toman: the maker funds, the taker sends the foreign leg.
    v_irt_payer := o.user_id;
    v_irt_minor := p_amount_minor;
    v_foreign_minor := public.convert_minor(p_amount_minor, 'IRT', v_foreign, p_agreed_rate);
  else
    v_irt_payer := auth.uid();
    v_foreign_minor := p_amount_minor;
    v_irt_minor := public.convert_minor(p_amount_minor, v_foreign, 'IRT', p_agreed_rate);
  end if;

  if v_irt_minor > public.p2p_tier_ceiling(auth.uid())
     or v_irt_minor > public.p2p_tier_ceiling(o.user_id) then
    raise exception 'that amount is above the ceiling for one side''s verification tier';
  end if;

  v_office := public.p2p_route_escrow(v_corridor);
  if v_office is null then
    raise exception 'no active exchange office covers % right now', v_corridor;
  end if;

  -- The escrow fee is the office's; the platform takes its usual cut. Both come
  -- out of the Toman leg, as in §8, so `post_order_release` needs no special case.
  v_platform_fee := (v_irt_minor * 25) / 10000;
  v_office_fee := (v_irt_minor * 15) / 10000;

  insert into public.p2p_trades (
    offer_id, taker_id, maker_id, amount_minor, agreed_rate, escrow_office_id, state
  ) values (
    p_offer, auth.uid(), o.user_id, p_amount_minor, p_agreed_rate, v_office, 'matched'
  ) returning id into v_trade;

  insert into public.orders (
    customer_id, office_id, corridor, send_currency, send_amount_minor,
    receive_currency, receive_amount_minor, locked_rate, rate_locked_at, rate_expires_at,
    platform_fee_minor, office_fee_minor,
    state, is_p2p, p2p_trade_id, origin, sla_target_at, due_at, notes
  ) values (
    v_irt_payer, v_office, v_corridor, 'IRT', v_irt_minor,
    v_foreign, v_foreign_minor, p_agreed_rate, now(), now() + interval '30 minutes',
    v_platform_fee, v_office_fee,
    'draft', true, v_trade, 'customer',
    now() + interval '1 day', now() + interval '3 days',
    'P2P trade — the exchange office confirms both legs, it is not the counterparty.'
  ) returning id into v_order;

  update public.p2p_trades set order_id = v_order where id = v_trade;
  if v_taken + p_amount_minor = o.amount_minor then
    update public.p2p_offers set status = 'filled' where id = p_offer;
  end if;

  -- Straight to the assigned office. Routing is not a decision anyone made, so
  -- the actor is null and the role is 'platform' — the same shape submission
  -- uses in 0012.
  perform public.assert_transition(v_order, 'draft', 'submitted', null, 'platform', 'p2p trade matched', null);
  perform public.assert_transition(v_order, 'submitted', 'matching', null, 'platform', 'routed to the escrow office', null);
  perform public.assert_transition(v_order, 'matching', 'office_review', null, 'platform', 'assigned as escrow agent', null);

  perform public.audit_event('p2p.trade_take', 'p2p_trades', v_trade, null,
    jsonb_build_object('offer_id', p_offer, 'order_id', v_order, 'escrow_office_id', v_office), null);
  return v_trade;
end $$;

/**
 * The trade's chat (§9). Both principals plus the escrow office, which has to
 * see the evidence it is being asked to confirm. Same shape as
 * `conversation_for_order`: derived, never asserted (ADR 0017).
 */
create or replace function public.conversation_for_trade(p_trade uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  tr public.p2p_trades%rowtype;
  v_id uuid;
begin
  select * into tr from public.p2p_trades where id = p_trade;
  if tr.id is null then raise exception 'trade not found'; end if;
  if auth.uid() not in (tr.taker_id, tr.maker_id)
     and not public.is_office_member(tr.escrow_office_id)
     and not public.is_platform_staff() then
    raise exception 'not a party to this trade';
  end if;

  select id into v_id from public.conversations
   where kind = 'p2p' and subject_id = p_trade and deleted_at is null;
  if v_id is null then
    insert into public.conversations (kind, subject_id, status)
    values ('p2p', p_trade, 'open') returning id into v_id;
  end if;

  insert into public.conversation_participants (conversation_id, user_id, role)
  values (v_id, tr.taker_id, 'taker'), (v_id, tr.maker_id, 'maker')
  on conflict (conversation_id, user_id) do update set deleted_at = null;

  insert into public.conversation_participants (conversation_id, user_id, role)
  select v_id, m.user_id, 'escrow'
    from public.memberships m
   where m.scope_type = 'office' and m.scope_id = tr.escrow_office_id and m.deleted_at is null
  on conflict (conversation_id, user_id) do update set deleted_at = null;

  return v_id;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- E. Settlement, reputation, disputes
-- ─────────────────────────────────────────────────────────────────────────────

/**
 * Release, with the one thing P2P genuinely changes: the net Toman belongs to
 * the counterparty, not to the office. The office is the escrow agent and takes
 * only its fee — crediting it the principal would be the platform quietly
 * inventing a party to the trade.
 */
create or replace function public.post_order_release(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  o public.orders%rowtype;
  v_txn uuid := gen_random_uuid();
  v_toman bigint;
  v_net bigint;
  v_counterparty uuid;
begin
  select * into o from public.orders where id = p_order;
  v_toman := case when o.send_currency = 'IRT' then o.send_amount_minor
                  else o.receive_amount_minor end;
  v_net := v_toman - o.platform_fee_minor - o.office_fee_minor;
  if v_net <= 0 then
    raise exception 'order %: fees (% + %) exceed the toman leg (%)',
      p_order, o.platform_fee_minor, o.office_fee_minor, v_toman;
  end if;

  if o.is_p2p and o.p2p_trade_id is not null then
    select case when t.maker_id = o.customer_id then t.taker_id else t.maker_id end
      into v_counterparty
      from public.p2p_trades t where t.id = o.p2p_trade_id;
  end if;

  insert into public.ledger_entries (txn_id, ledger_account_id, direction, amount_minor, currency, order_id, memo)
  values
    (v_txn, public.ledger_account('customer', o.customer_id, 'IRT', 'irt_payable'),
     'debit', v_toman, 'IRT', p_order, 'toman released'),
    (v_txn, public.ledger_account('platform', null, 'IRT', 'irt_fees'),
     'credit', o.platform_fee_minor, 'IRT', p_order, 'platform fee'),
    (v_txn, public.ledger_account('office', o.office_id, 'IRT', 'irt_fees'),
     'credit', o.office_fee_minor, 'IRT', p_order,
     case when v_counterparty is null then 'office fee' else 'escrow fee' end),
    (v_txn,
     case when v_counterparty is null
          then public.ledger_account('office', o.office_id, 'IRT', 'irt_settlement')
          else public.ledger_account('customer', v_counterparty, 'IRT', 'irt_payable') end,
     'credit', v_net, 'IRT', p_order,
     case when v_counterparty is null then 'office settlement' else 'p2p counterparty settlement' end);
end $$;

/** Individual ratings, so `reputation.rating_avg` is an average of something. */
create table public.p2p_ratings (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.p2p_trades (id),
  rater_id uuid not null references public.profiles (id),
  ratee_id uuid not null references public.profiles (id),
  score int not null check (score between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (trade_id, rater_id)
);
alter table public.p2p_ratings enable row level security;
create policy p2p_ratings_public_read on public.p2p_ratings for select using (true);
create trigger t_p2p_ratings_append_only
  before update or delete on public.p2p_ratings
  for each row execute function public.forbid_mutation();

create or replace function public.p2p_refresh_reputation(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_completed int;
  v_terminal int;
  v_release int;
  v_rating numeric;
begin
  select count(*) filter (where t.state = 'completed'),
         count(*) filter (where t.state in ('completed','cancelled','refunded','expired'))
    into v_completed, v_terminal
    from public.p2p_trades t
   where (t.taker_id = p_user or t.maker_id = p_user) and t.deleted_at is null;

  -- How long this person's trades take from funded to released, which is the
  -- number a counterparty actually cares about.
  select avg(extract(epoch from (rel.created_at - fund.created_at)))::int
    into v_release
    from public.p2p_trades t
    join public.orders o on o.id = t.order_id
    join public.order_events fund on fund.order_id = o.id and fund.to_state = 'irt_funded'
    join public.order_events rel on rel.order_id = o.id and rel.to_state = 'irt_released'
   where (t.taker_id = p_user or t.maker_id = p_user) and t.state = 'completed';

  select round(avg(score), 2) into v_rating
    from public.p2p_ratings where ratee_id = p_user;

  insert into public.reputation (user_id, trades_completed, completion_rate, avg_release_seconds, rating_avg)
  values (p_user, coalesce(v_completed, 0),
          case when coalesce(v_terminal, 0) = 0 then 0
               else round(100.0 * v_completed / v_terminal, 2) end,
          v_release, v_rating)
  on conflict (user_id) do update set
    trades_completed = excluded.trades_completed,
    completion_rate = excluded.completion_rate,
    avg_release_seconds = excluded.avg_release_seconds,
    rating_avg = excluded.rating_avg,
    updated_at = now();
end $$;

/**
 * A P2P trade's state is a projection of its order's, never an independent
 * record — the order is on the machine, so the trade cannot disagree with it.
 */
create or replace function public.p2p_settle()
returns trigger language plpgsql security definer set search_path = public as $$
declare tr public.p2p_trades%rowtype;
begin
  if not new.is_p2p or new.p2p_trade_id is null or new.state = old.state then
    return null;
  end if;

  select * into tr from public.p2p_trades where id = new.p2p_trade_id;
  if tr.id is null then return null; end if;

  update public.p2p_trades
     set state = case new.state
           when 'completed' then 'completed'
           when 'cancelled' then 'cancelled'
           when 'refunded' then 'refunded'
           when 'expired' then 'expired'
           when 'disputed' then 'disputed'
           else 'in_progress' end
   where id = tr.id;

  if new.state in ('completed','cancelled','refunded','expired') then
    perform public.p2p_refresh_reputation(tr.taker_id);
    perform public.p2p_refresh_reputation(tr.maker_id);
  end if;
  return null;
end $$;

create trigger t_orders_p2p_settle
  after update of state on public.orders
  for each row execute function public.p2p_settle();

/**
 * Either principal can freeze a trade (§9). The order goes to `disputed`, which
 * is where compliance already looks — there is no separate dispute machine, and
 * the written reason lands on the timeline both sides read.
 */
create or replace function public.p2p_trade_dispute(p_trade uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  tr public.p2p_trades%rowtype;
  v_state public.order_state;
begin
  if coalesce(length(btrim(coalesce(p_reason, ''))), 0) < 8 then
    raise exception 'a dispute needs a written reason';
  end if;

  select * into tr from public.p2p_trades where id = p_trade;
  if tr.id is null then raise exception 'trade not found'; end if;
  if auth.uid() not in (tr.taker_id, tr.maker_id) and not public.is_platform_staff() then
    raise exception 'only a party to the trade may raise a dispute';
  end if;
  if tr.order_id is null then raise exception 'that trade has no order yet'; end if;

  select state into v_state from public.orders where id = tr.order_id;
  if not ('disputed' = any (public.allowed_transitions(v_state))) then
    raise exception 'a trade in % cannot be disputed', v_state;
  end if;

  -- Either principal may raise it, including the one who is not the order's
  -- customer, so this goes through as the platform rather than through the
  -- role matrix — with the raiser recorded in the audit trail.
  perform public.assert_transition(tr.order_id, v_state, 'disputed', auth.uid(), 'platform', p_reason, null);
  perform public.audit_event('p2p.dispute', 'p2p_trades', p_trade,
    jsonb_build_object('state', v_state), jsonb_build_object('state', 'disputed'), p_reason);
end $$;

create or replace function public.p2p_rate(p_trade uuid, p_score int, p_comment text default null)
returns void language plpgsql security definer set search_path = public as $$
declare tr public.p2p_trades%rowtype; v_ratee uuid;
begin
  select * into tr from public.p2p_trades where id = p_trade;
  if tr.id is null then raise exception 'trade not found'; end if;
  if auth.uid() not in (tr.taker_id, tr.maker_id) then
    raise exception 'only a party to the trade may rate it';
  end if;
  if tr.state <> 'completed' then raise exception 'rate a trade once it has completed'; end if;
  if p_score is null or p_score < 1 or p_score > 5 then raise exception 'score must be 1 to 5'; end if;

  v_ratee := case when tr.taker_id = auth.uid() then tr.maker_id else tr.taker_id end;
  insert into public.p2p_ratings (trade_id, rater_id, ratee_id, score, comment)
  values (p_trade, auth.uid(), v_ratee, p_score,
          nullif(btrim(coalesce(p_comment, '')), ''));

  perform public.p2p_refresh_reputation(v_ratee);
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- F. Policies and grants
-- ─────────────────────────────────────────────────────────────────────────────

-- Publishing is a function now, for the reasons in ADR 0017; the direct insert
-- would have skipped the verification, the corridor rule and every limit.
drop policy if exists p2p_offers_own on public.p2p_offers;
drop policy if exists p2p_offers_update_own on public.p2p_offers;
create policy p2p_offers_moderate on public.p2p_offers
  for update using (public.is_platform_staff())
  with check (public.is_platform_staff());

create trigger t_p2p_offers_no_delete before delete on public.p2p_offers
  for each row execute function public.forbid_delete();
create trigger t_p2p_trades_no_delete before delete on public.p2p_trades
  for each row execute function public.forbid_delete();

revoke all on function public.currency_scale(text) from public, anon, authenticated;
revoke all on function public.convert_minor(bigint, text, text, numeric) from public, anon, authenticated;
revoke all on function public.p2p_limits() from public, anon, authenticated;
revoke all on function public.p2p_tier_ceiling(uuid) from public, anon, authenticated;
revoke all on function public.p2p_offer_publish(jsonb) from public, anon, authenticated;
revoke all on function public.p2p_offer_close(uuid, text) from public, anon, authenticated;
revoke all on function public.p2p_route_escrow(text) from public, anon, authenticated;
revoke all on function public.p2p_trade_take(uuid, bigint, numeric) from public, anon, authenticated;
revoke all on function public.conversation_for_trade(uuid) from public, anon, authenticated;
revoke all on function public.p2p_refresh_reputation(uuid) from public, anon, authenticated;
revoke all on function public.p2p_settle() from public, anon, authenticated;
revoke all on function public.p2p_trade_dispute(uuid, text) from public, anon, authenticated;
revoke all on function public.p2p_rate(uuid, int, text) from public, anon, authenticated;
revoke all on function public.post_order_release(uuid) from public, anon, authenticated;

-- The board and the converter are public surfaces, so the scale is too.
grant execute on function public.currency_scale(text) to anon, authenticated;
grant execute on function public.convert_minor(bigint, text, text, numeric) to anon, authenticated;
grant execute on function public.p2p_limits() to authenticated;
grant execute on function public.p2p_tier_ceiling(uuid) to authenticated;
grant execute on function public.p2p_offer_publish(jsonb) to authenticated;
grant execute on function public.p2p_offer_close(uuid, text) to authenticated;
grant execute on function public.p2p_trade_take(uuid, bigint, numeric) to authenticated;
grant execute on function public.conversation_for_trade(uuid) to authenticated;
grant execute on function public.p2p_trade_dispute(uuid, text) to authenticated;
grant execute on function public.p2p_rate(uuid, int, text) to authenticated;
