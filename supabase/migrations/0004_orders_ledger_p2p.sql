-- 0004 — Orders, append-only events, double-entry ledger, P2P (§8, §9, §11)

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  public_ref text not null unique,             -- ASA-8F3K2Q (§17.2)
  customer_id uuid not null references public.profiles (id),
  office_id uuid references public.exchange_offices (id),
  corridor text not null,                      -- 'USD-IRT'
  send_currency text not null,
  send_amount_minor bigint not null check (send_amount_minor > 0),
  receive_currency text not null,
  receive_amount_minor bigint not null check (receive_amount_minor >= 0),
  locked_rate numeric(28,10) not null,
  rate_locked_at timestamptz not null,
  rate_expires_at timestamptz not null,
  platform_fee_minor bigint not null default 0,
  office_fee_minor bigint not null default 0,
  spread_breakdown jsonb not null default '[]'::jsonb,
  source_account_id uuid references public.beneficiary_accounts (id),
  destination_account_id uuid references public.beneficiary_accounts (id),
  state public.order_state not null default 'draft',
  state_since timestamptz not null default now(),
  due_at timestamptz,                          -- hard SLA (3 business days)
  sla_target_at timestamptz,                   -- target (1 business day)
  version int not null default 1,              -- optimistic concurrency (§8.1)
  purpose_of_transfer text,                    -- §17.15
  notes text,
  cancelled_reason text,
  is_p2p boolean not null default false,
  p2p_trade_id uuid,
  origin text not null default 'customer' check (origin in ('customer','admin_on_behalf')),  -- §16.5
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index orders_customer on public.orders (customer_id, created_at desc);
create index orders_office_state on public.orders (office_id, state);

-- Append-only event stream driving the timeline UI (§8.1).
create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id),
  from_state public.order_state,
  to_state public.order_state not null,
  actor_id uuid references public.profiles (id),
  actor_role text,
  reason text,
  attachment_path text,
  ip inet,
  user_agent text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index order_events_order on public.order_events (order_id, created_at);
create trigger t_order_events_append_only
  before update or delete on public.order_events
  for each row execute function public.forbid_mutation();

create table public.order_documents (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id),
  kind text not null check (kind in ('irt_receipt','swift_mt103','foreign_receipt','invoice')),
  storage_path text not null,
  uploaded_by uuid references public.profiles (id),
  verified_by uuid references public.profiles (id),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ── State machine guard (§8.1): the ONLY path that changes orders.state ─────
create or replace function public.allowed_transitions(s public.order_state)
returns public.order_state[] language sql immutable as $$
  select case s
    when 'draft' then array['submitted','cancelled','expired']::public.order_state[]
    when 'submitted' then array['matching','cancelled','expired']::public.order_state[]
    when 'matching' then array['office_review','cancelled','expired']::public.order_state[]
    when 'office_review' then array['accepted','info_needed','cancelled','expired']::public.order_state[]
    when 'accepted' then array['awaiting_irt_funding','cancelled']::public.order_state[]
    when 'awaiting_irt_funding' then array['irt_funded','cancelled','expired']::public.order_state[]
    -- Directionality (§8.1): the Toman leg funds first and releases last —
    -- there is deliberately NO path from foreign states back before irt_funded.
    when 'irt_funded' then array['foreign_leg_pending','disputed','refunded']::public.order_state[]
    when 'foreign_leg_pending' then array['foreign_leg_sent','disputed','on_hold']::public.order_state[]
    when 'foreign_leg_sent' then array['recipient_confirmed','disputed','on_hold']::public.order_state[]
    when 'recipient_confirmed' then array['irt_released','disputed']::public.order_state[]
    when 'irt_released' then array['completed']::public.order_state[]
    when 'info_needed' then array['office_review','cancelled','expired']::public.order_state[]
    when 'on_hold' then array['foreign_leg_pending','foreign_leg_sent','disputed','refunded']::public.order_state[]
    when 'disputed' then array['on_hold','refunded','completed','sla_breached']::public.order_state[]
    else array[]::public.order_state[]
  end;
$$;

create or replace function public.assert_transition(
  p_order uuid,
  p_from public.order_state,
  p_to public.order_state,
  p_actor uuid,
  p_actor_role text,
  p_reason text default null,
  p_expected_version int default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_state public.order_state;
  v_version int;
begin
  select state, version into v_state, v_version from public.orders where id = p_order for update;
  if v_state is null then
    raise exception 'order % not found', p_order;
  end if;
  if v_state <> p_from then
    raise exception 'order % is in state %, expected %', p_order, v_state, p_from;
  end if;
  if p_expected_version is not null and v_version <> p_expected_version then
    raise exception 'order % version mismatch (have %, expected %)', p_order, v_version, p_expected_version;
  end if;
  if not (p_to = any (public.allowed_transitions(p_from))) then
    raise exception 'transition % → % is not allowed', p_from, p_to;
  end if;

  update public.orders
    set state = p_to, state_since = now(), version = version + 1
    where id = p_order;

  insert into public.order_events (order_id, from_state, to_state, actor_id, actor_role, reason)
    values (p_order, p_from, p_to, p_actor, p_actor_role, p_reason);
end $$;

-- ── Double-entry ledger (§11, §17.1) ────────────────────────────────────────
create table public.ledger_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('platform','office','customer','suspense')),
  owner_id uuid,
  currency text not null,
  code text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (owner_type, owner_id, currency, code)
);

create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  txn_id uuid not null,
  ledger_account_id uuid not null references public.ledger_accounts (id),
  direction public.ledger_direction not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null,
  order_id uuid references public.orders (id),
  memo text,
  created_at timestamptz not null default now()
);
create index ledger_entries_txn on public.ledger_entries (txn_id);
create index ledger_entries_account on public.ledger_entries (ledger_account_id, created_at desc);
create trigger t_ledger_entries_append_only
  before update or delete on public.ledger_entries
  for each row execute function public.forbid_mutation();

-- Per-txn balance invariant: Σdebits = Σcredits per currency (deferred).
create or replace function public.assert_txn_balanced()
returns trigger language plpgsql as $$
declare v_bad int;
begin
  select count(*) into v_bad from (
    select currency,
      sum(case when direction = 'debit' then amount_minor else 0 end) as d,
      sum(case when direction = 'credit' then amount_minor else 0 end) as c
    from public.ledger_entries where txn_id = new.txn_id
    group by currency
  ) t where t.d <> t.c;
  if v_bad > 0 then
    raise exception 'ledger txn % does not balance', new.txn_id;
  end if;
  return null;
end $$;

create constraint trigger t_ledger_balanced
  after insert on public.ledger_entries
  deferrable initially deferred
  for each row execute function public.assert_txn_balanced();

-- ── P2P (§9) ────────────────────────────────────────────────────────────────
create table public.p2p_offers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  side text not null check (side in ('have','want')),
  have_currency text not null,
  want_currency text not null,
  amount_minor bigint not null check (amount_minor > 0),
  min_slice_minor bigint,
  max_slice_minor bigint,
  rate_mode text not null check (rate_mode in ('fixed','market_offset')),
  rate_value numeric(28,10) not null,
  terms text,
  expires_at timestamptz,
  status text not null default 'open' check (status in ('open','paused','filled','cancelled','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.p2p_trades (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.p2p_offers (id),
  taker_id uuid not null references public.profiles (id),
  maker_id uuid not null references public.profiles (id),
  amount_minor bigint not null check (amount_minor > 0),
  agreed_rate numeric(28,10) not null,
  escrow_office_id uuid references public.exchange_offices (id),  -- office as escrow agent (§9)
  state text not null default 'open',
  order_id uuid references public.orders (id),
  dispute_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.reputation (
  user_id uuid primary key references public.profiles (id),
  trades_completed int not null default 0,
  completion_rate numeric(5,2) not null default 0,
  avg_release_seconds int,
  rating_avg numeric(3,2),
  badges jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- updated_at triggers
create trigger t_orders_updated before update on public.orders for each row execute function public.set_updated_at();
create trigger t_order_documents_updated before update on public.order_documents for each row execute function public.set_updated_at();
create trigger t_ledger_accounts_updated before update on public.ledger_accounts for each row execute function public.set_updated_at();
create trigger t_p2p_offers_updated before update on public.p2p_offers for each row execute function public.set_updated_at();
create trigger t_p2p_trades_updated before update on public.p2p_trades for each row execute function public.set_updated_at();
create trigger t_reputation_updated before update on public.reputation for each row execute function public.set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.orders enable row level security;
alter table public.order_events enable row level security;
alter table public.order_documents enable row level security;
alter table public.ledger_accounts enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.p2p_offers enable row level security;
alter table public.p2p_trades enable row level security;
alter table public.reputation enable row level security;

-- Customers see their own orders; offices see orders claimed by them; staff all.
create policy orders_visibility on public.orders
  for select using (
    customer_id = auth.uid()
    or (office_id is not null and public.is_office_member(office_id))
    or public.is_platform_staff()
  );
-- The client can only create drafts; every state change goes through
-- assert_transition (security definer). Direct UPDATE of state is not granted.
create policy orders_insert_draft on public.orders
  for insert with check (customer_id = auth.uid() and state = 'draft');

create policy order_events_visibility on public.order_events
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and (o.customer_id = auth.uid()
          or (o.office_id is not null and public.is_office_member(o.office_id))
          or public.is_platform_staff())
    )
  );

create policy order_documents_visibility on public.order_documents
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and (o.customer_id = auth.uid()
          or (o.office_id is not null and public.is_office_member(o.office_id))
          or public.is_platform_staff())
    )
  );

create policy ledger_accounts_staff on public.ledger_accounts
  for select using (public.is_platform_staff());
create policy ledger_entries_staff on public.ledger_entries
  for select using (public.is_platform_staff());

create policy p2p_offers_read on public.p2p_offers
  for select using (status = 'open' or user_id = auth.uid() or public.is_platform_staff());
create policy p2p_offers_own on public.p2p_offers
  for insert with check (user_id = auth.uid());
create policy p2p_offers_update_own on public.p2p_offers
  for update using (user_id = auth.uid() or public.is_platform_staff());

create policy p2p_trades_parties on public.p2p_trades
  for select using (
    taker_id = auth.uid() or maker_id = auth.uid()
    or (escrow_office_id is not null and public.is_office_member(escrow_office_id))
    or public.is_platform_staff()
  );

create policy reputation_public_read on public.reputation for select using (true);
