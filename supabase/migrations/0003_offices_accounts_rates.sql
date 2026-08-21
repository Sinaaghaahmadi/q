-- 0003 — Exchange offices, customer accounts, rates (§11)

create table public.exchange_offices (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  legal_name_fa text not null,
  legal_name_en text not null,
  license_no text not null,
  country text not null default 'IR',
  city text,
  status text not null default 'draft' check (status in ('draft','active','suspended','archived')),
  branding jsonb not null default '{}'::jsonb,        -- logo, colors, display_name (§4.2)
  contact jsonb not null default '{}'::jsonb,
  working_hours jsonb not null default '{}'::jsonb,
  corridors jsonb not null default '[]'::jsonb,
  auto_accept_rules jsonb not null default '{}'::jsonb,
  sla_overrides jsonb not null default '{}'::jsonb,
  created_by_admin uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.office_accounts (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.exchange_offices (id),
  currency text not null,
  kind text not null check (kind in ('iban','card','swift','cash')),
  details jsonb not null default '{}'::jsonb,
  is_public boolean not null default false,   -- shown to customers as payment target
  active boolean not null default true,
  label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.office_rate_config (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.exchange_offices (id),
  corridor text not null,                      -- e.g. 'USD-IRT'
  spread_bps int not null default 0,
  min_amount_minor bigint,
  max_amount_minor bigint,
  cutoff_time time,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (office_id, corridor)
);

create table public.office_balances (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.exchange_offices (id),
  currency text not null,
  available_minor bigint not null default 0,
  reserved_minor bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (office_id, currency)
);

create table public.beneficiary_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  nickname text not null,
  currency text not null,
  country text not null,
  kind text not null check (kind in ('sheba','card','iban','swift','cash_pickup')),
  details jsonb not null default '{}'::jsonb,
  holder_name text not null,
  is_third_party boolean not null default false,   -- must match KYC name unless declared (§6)
  verification_state text not null default 'unverified'
    check (verification_state in ('unverified','pending','verified','rejected')),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ── Rates (§7) ───────────────────────────────────────────────────────────────
create table public.rate_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  kind text not null check (kind in ('tgju','frankfurter','manual','demo')),
  config jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  last_ok_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.rate_snapshots (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.rate_sources (id),
  pair text not null,
  bid numeric(28,10) not null,
  ask numeric(28,10) not null,
  mid numeric(28,10) not null,
  observed_at timestamptz not null,
  raw jsonb,
  created_at timestamptz not null default now()
);
create index rate_snapshots_pair_time on public.rate_snapshots (pair, observed_at desc);

create table public.rate_candles (
  id uuid primary key default gen_random_uuid(),
  pair text not null,
  interval text not null check ("interval" in ('5m','1h','1d')),
  open numeric(28,10) not null,
  high numeric(28,10) not null,
  low numeric(28,10) not null,
  close numeric(28,10) not null,
  bucket_start timestamptz not null,
  created_at timestamptz not null default now(),
  unique (pair, "interval", bucket_start)
);

create table public.price_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  pair text not null,
  direction text not null check (direction in ('above','below')),
  threshold numeric(28,10) not null,
  channels text[] not null default '{inapp}',
  active boolean not null default true,
  last_fired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- updated_at triggers
create trigger t_offices_updated before update on public.exchange_offices for each row execute function public.set_updated_at();
create trigger t_office_accounts_updated before update on public.office_accounts for each row execute function public.set_updated_at();
create trigger t_office_rate_config_updated before update on public.office_rate_config for each row execute function public.set_updated_at();
create trigger t_office_balances_updated before update on public.office_balances for each row execute function public.set_updated_at();
create trigger t_beneficiary_accounts_updated before update on public.beneficiary_accounts for each row execute function public.set_updated_at();
create trigger t_rate_sources_updated before update on public.rate_sources for each row execute function public.set_updated_at();
create trigger t_price_alerts_updated before update on public.price_alerts for each row execute function public.set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.exchange_offices enable row level security;
alter table public.office_accounts enable row level security;
alter table public.office_rate_config enable row level security;
alter table public.office_balances enable row level security;
alter table public.beneficiary_accounts enable row level security;
alter table public.rate_sources enable row level security;
alter table public.rate_snapshots enable row level security;
alter table public.rate_candles enable row level security;
alter table public.price_alerts enable row level security;

-- Active office directory is public (§4.1 /exchanges); full row for members/staff.
create policy offices_public_read on public.exchange_offices
  for select using (status = 'active' or public.is_office_member(id) or public.is_platform_staff());
create policy offices_admin_write on public.exchange_offices
  for all using (public.has_role(array['platform_admin','platform_superadmin']::public.app_role[]))
  with check (public.has_role(array['platform_admin','platform_superadmin']::public.app_role[]));

create policy office_accounts_scoped on public.office_accounts
  for select using (
    (is_public and active) or public.is_office_member(office_id) or public.is_platform_staff()
  );
create policy office_accounts_manage on public.office_accounts
  for all using (
    public.has_role(array['office_finance','office_owner']::public.app_role[], 'office', office_id)
    or public.has_role(array['platform_admin','platform_superadmin']::public.app_role[])
  );

create policy office_rate_config_scoped on public.office_rate_config
  for select using (public.is_office_member(office_id) or public.is_platform_staff());
create policy office_rate_config_manage on public.office_rate_config
  for all using (
    public.has_role(array['office_owner']::public.app_role[], 'office', office_id)
    or public.has_role(array['platform_admin','platform_superadmin']::public.app_role[])
  );

create policy office_balances_scoped on public.office_balances
  for select using (
    public.has_role(array['office_finance','office_owner','office_viewer']::public.app_role[], 'office', office_id)
    or public.is_platform_staff()
  );

create policy beneficiary_accounts_own on public.beneficiary_accounts
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy beneficiary_accounts_staff_read on public.beneficiary_accounts
  for select using (public.is_platform_staff());

-- Rates are public read; writes come from the service role (Edge Function poller).
create policy rate_sources_staff on public.rate_sources
  for select using (public.is_platform_staff());
create policy rate_snapshots_public_read on public.rate_snapshots for select using (true);
create policy rate_candles_public_read on public.rate_candles for select using (true);

create policy price_alerts_own on public.price_alerts
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());
