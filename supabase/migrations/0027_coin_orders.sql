-- ─────────────────────────────────────────────────────────────────────────────
-- 0027 — Buying gold coins
--
-- A coin is not a currency, and the temptation to model it as one should be
-- resisted. `orders` exists to move money from a customer to a beneficiary in
-- another country: it has a corridor, a destination bank account, a rate lock
-- and a settlement leg abroad. A coin has a weight, a mint, and a counter you
-- collect it from. Pushing a coin through that machine would mean inventing
-- meanings for four of its states and leaving a beneficiary account null on
-- every row.
--
-- So coins get their own small table and their own five-state life:
--
--   requested → confirmed → paid → ready → collected
--                    ↘ cancelled (from any of the first four)
--
-- The office confirms it holds the stock and fixes a price; the customer pays;
-- the office prepares it; the customer collects it in person. That last step is
-- why there is no refund machinery here and no escrow: nothing leaves the shop
-- until somebody is standing in it.
--
-- The price is fixed at confirmation, not at request. Gold moves several
-- percent in a morning, and a request made at nine that an office accepts at
-- noon is a request the office would lose money on at the nine o'clock price.
-- The customer sees the confirmed price before they pay and may walk away.
-- ─────────────────────────────────────────────────────────────────────────────

do $$ begin
  create type public.coin_state as enum (
    'requested',   -- the customer has asked; no stock committed yet
    'confirmed',   -- the office holds it and has fixed a price
    'paid',        -- the customer has paid the office
    'ready',       -- prepared and waiting at the counter
    'collected',   -- handed over. Terminal.
    'cancelled'    -- by either side, before collection. Terminal.
  );
exception when duplicate_object then null; end $$;

create table if not exists public.coin_orders (
  id uuid primary key default gen_random_uuid(),
  public_ref text unique,
  customer_id uuid not null references public.profiles (id),
  office_id uuid references public.exchange_offices (id),
  /** A code from `src/lib/coins/catalog.ts` — EMAMI, NIM, GERAM18, … */
  product text not null,
  quantity int not null check (quantity between 1 and 100),
  /**
   * What the market said when the customer asked, in Toman. Kept even after
   * confirmation: the gap between it and `unit_price_minor` is the office's
   * margin, and a customer who feels overcharged is asking about exactly that.
   */
  quoted_unit_minor bigint not null check (quoted_unit_minor > 0),
  /** What the office fixed at confirmation. Null until then. */
  unit_price_minor bigint check (unit_price_minor > 0),
  total_minor bigint generated always as (
    coalesce(unit_price_minor, quoted_unit_minor) * quantity
  ) stored,
  state public.coin_state not null default 'requested',
  state_since timestamptz not null default now(),
  /** Where the customer will collect it. Free text: a branch, not an address. */
  pickup_note text,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists coin_orders_customer
  on public.coin_orders (customer_id, created_at desc);
create index if not exists coin_orders_office_open
  on public.coin_orders (office_id, state)
  where state not in ('collected', 'cancelled');

drop trigger if exists t_coin_orders_updated on public.coin_orders;
create trigger t_coin_orders_updated
  before update on public.coin_orders
  for each row execute function public.set_updated_at();

drop trigger if exists t_coin_orders_no_delete on public.coin_orders;
create trigger t_coin_orders_no_delete
  before delete on public.coin_orders
  for each row execute function public.forbid_delete();

/** Append-only, like every other timeline in this schema. */
create table if not exists public.coin_events (
  id bigserial primary key,
  coin_order_id uuid not null references public.coin_orders (id),
  from_state public.coin_state,
  to_state public.coin_state not null,
  actor_id uuid references public.profiles (id),
  note text,
  created_at timestamptz not null default now()
);
create index if not exists coin_events_order on public.coin_events (coin_order_id, id);

drop trigger if exists t_coin_events_append_only on public.coin_events;
create trigger t_coin_events_append_only
  before update or delete on public.coin_events
  for each row execute function public.forbid_mutation();

-- A. A reference a person can read down a phone ──────────────────────────────

create or replace function public.gen_coin_ref()
returns text
language plpgsql
volatile
-- `gen_random_bytes` is pgcrypto's, and pgcrypto lives in `extensions` on a
-- hosted project rather than in `public`.
set search_path = public, extensions, pg_temp
as $$
declare
  v_ref text;
begin
  loop
    -- The same alphabet the rest of the app uses for anything read aloud: no
    -- O/0, no I/1, no S/5.
    v_ref := 'GLD-' || upper(
      substr(translate(encode(gen_random_bytes(6), 'base64'), '+/=OI015S', 'ABCDXYZWV'), 1, 6));
    exit when not exists (select 1 from public.coin_orders where public_ref = v_ref);
  end loop;
  return v_ref;
end;
$$;

-- B. Placing a request ───────────────────────────────────────────────────────

/**
 * Ask an office for coins.
 *
 * `quoted_unit_minor` comes from the client, and that is fine here in a way it
 * would not be for a transfer: it is recorded as *what the customer was shown*,
 * never as what they will pay. The office fixes the real price at confirmation
 * and the customer sees it before paying. A client that lies about the quote
 * lies only about its own screen.
 */
create or replace function public.coin_order_create(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_product text := upper(btrim(coalesce(p_payload->>'product', '')));
  v_quantity int := coalesce((p_payload->>'quantity')::int, 1);
  v_quoted bigint := coalesce((p_payload->>'quoted_unit_minor')::bigint, 0);
  v_office uuid := nullif(p_payload->>'office_id', '')::uuid;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if v_product !~ '^[A-Z0-9]{3,12}$' then raise exception 'unknown product'; end if;
  if v_quantity < 1 or v_quantity > 100 then raise exception 'quantity must be between 1 and 100'; end if;
  if v_quoted <= 0 then raise exception 'a quoted price is required'; end if;

  if v_office is not null and not exists (
    select 1 from public.exchange_offices
     where id = v_office and status = 'active' and deleted_at is null
  ) then
    raise exception 'that office is not open for business';
  end if;

  insert into public.coin_orders (
    public_ref, customer_id, office_id, product, quantity, quoted_unit_minor, pickup_note
  ) values (
    public.gen_coin_ref(), auth.uid(), v_office, v_product, v_quantity, v_quoted,
    nullif(btrim(coalesce(p_payload->>'pickup_note', '')), '')
  ) returning id into v_id;

  insert into public.coin_events (coin_order_id, from_state, to_state, actor_id, note)
  values (v_id, null, 'requested', auth.uid(), null);

  return v_id;
end;
$$;

-- C. Moving it along ─────────────────────────────────────────────────────────

/**
 * The only way a coin order changes state.
 *
 * Who may make which move is decided here rather than by policy, because the
 * answer depends on the move: a customer may cancel their own order until it is
 * collected, and may do nothing else; an office may do everything except cancel
 * on the customer's behalf without saying why.
 */
create or replace function public.coin_order_advance(
  p_order uuid,
  p_to public.coin_state,
  p_note text default null
) returns public.coin_state
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.coin_orders;
  v_is_customer boolean;
  v_is_office boolean;
  v_is_staff boolean := public.is_platform_staff();
  -- `p_note` carries two different things: the fixed unit price on a
  -- confirmation, and a free-text reason on a cancellation. Casting it
  -- unconditionally would abort every cancellation that gave a reason in words,
  -- which is every cancellation worth having, so it is parsed only when it
  -- looks like a number.
  v_unit bigint := case
    when coalesce(p_note, '') ~ '^[0-9]+$' then p_note::bigint
    else null end;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  select * into v_row from public.coin_orders where id = p_order for update;
  if v_row.id is null then raise exception 'no such order'; end if;

  v_is_customer := v_row.customer_id = auth.uid();
  v_is_office := v_row.office_id is not null and public.is_office_member(v_row.office_id);
  if not (v_is_customer or v_is_office or v_is_staff) then
    raise exception 'not your order';
  end if;

  if v_row.state in ('collected', 'cancelled') then
    raise exception 'this order is already %', v_row.state;
  end if;

  if p_to = 'cancelled' then
    -- Either side may walk away before the coins change hands. A customer who
    -- has already paid is refunded by the office directly; there is no escrow
    -- here to unwind, which is exactly why this stays out of the ledger.
    if not (v_is_customer or v_is_office or v_is_staff) then
      raise exception 'not allowed';
    end if;
  elsif not (v_is_office or v_is_staff) then
    raise exception 'only the office moves this order forward';
  else
    -- The forward path is strictly ordered. Skipping "paid" would mean handing
    -- over gold nobody has paid for.
    if not (
      (v_row.state = 'requested' and p_to = 'confirmed') or
      (v_row.state = 'confirmed' and p_to = 'paid') or
      (v_row.state = 'paid' and p_to = 'ready') or
      (v_row.state = 'ready' and p_to = 'collected')
    ) then
      raise exception 'cannot move a % order to %', v_row.state, p_to;
    end if;
  end if;

  update public.coin_orders
     set state = p_to,
         state_since = now(),
         -- Confirmation is where the price is fixed; `p_note` carries it there
         -- and carries a reason on a cancellation.
         unit_price_minor = case
           when p_to = 'confirmed' and v_unit is not null and v_unit > 0 then v_unit
           else unit_price_minor end,
         cancel_reason = case when p_to = 'cancelled' then p_note else cancel_reason end
   where id = p_order;

  insert into public.coin_events (coin_order_id, from_state, to_state, actor_id, note)
  values (p_order, v_row.state, p_to, auth.uid(), p_note);

  return p_to;
end;
$$;

/** An office takes an unassigned request out of the pool. */
create or replace function public.coin_order_claim(p_order uuid, p_office uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_state public.coin_state;
  v_office uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not public.is_office_member(p_office) then raise exception 'not a member of that office'; end if;

  select state, office_id into v_state, v_office
    from public.coin_orders where id = p_order for update;
  if v_state is null then raise exception 'no such order'; end if;
  if v_office is not null then raise exception 'another office already took this'; end if;
  if v_state <> 'requested' then raise exception 'only a new request can be claimed'; end if;

  update public.coin_orders set office_id = p_office where id = p_order;
  insert into public.coin_events (coin_order_id, from_state, to_state, actor_id, note)
  values (p_order, v_state, v_state, auth.uid(), 'claimed');
end;
$$;

-- D. Who sees what ───────────────────────────────────────────────────────────

alter table public.coin_orders enable row level security;
alter table public.coin_events enable row level security;

drop policy if exists coin_orders_visibility on public.coin_orders;
create policy coin_orders_visibility on public.coin_orders
  for select using (
    customer_id = auth.uid()
    or public.is_platform_staff()
    -- An office sees its own, plus the unclaimed pool it may take from.
    or (office_id is not null and public.is_office_member(office_id))
    or (office_id is null and state = 'requested' and exists (
          select 1 from public.memberships m
           where m.user_id = auth.uid() and m.scope_type = 'office' and m.deleted_at is null))
  );

drop policy if exists coin_events_visibility on public.coin_events;
create policy coin_events_visibility on public.coin_events
  for select using (
    exists (
      select 1 from public.coin_orders o
       where o.id = coin_events.coin_order_id
         and (o.customer_id = auth.uid()
              or public.is_platform_staff()
              or (o.office_id is not null and public.is_office_member(o.office_id)))
    )
  );

-- No insert or update policy anywhere: every write goes through the functions
-- above, which is what makes the state machine the only path.

-- E. Grants ──────────────────────────────────────────────────────────────────

revoke all on function public.coin_order_create(jsonb) from public;
revoke all on function public.coin_order_advance(uuid, public.coin_state, text) from public;
revoke all on function public.coin_order_claim(uuid, uuid) from public;
revoke all on function public.gen_coin_ref() from public, anon, authenticated;
grant execute on function public.coin_order_create(jsonb) to authenticated;
grant execute on function public.coin_order_advance(uuid, public.coin_state, text) to authenticated;
grant execute on function public.coin_order_claim(uuid, uuid) to authenticated;
grant select on public.coin_orders to authenticated;
grant select on public.coin_events to authenticated;
