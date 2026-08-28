-- 0002 — Identity & access: profiles, memberships, KYC, sanctions (§11)

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name_fa text,
  full_name_latin text,
  phone text unique,
  phone_verified_at timestamptz,
  email text,
  locale text not null default 'fa',
  theme text not null default 'system',
  national_code text,          -- column-level encryption via pgsodium in Phase 2 (§15)
  dob date,
  nationality text,
  address jsonb,
  kyc_status public.kyc_status not null default 'unverified',
  risk_tier smallint not null default 0,
  limits jsonb not null default '{}'::jsonb,
  referral_code text unique,
  referred_by uuid references public.profiles (id),
  frozen_at timestamptz,
  frozen_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  role public.app_role not null,
  scope_type text not null check (scope_type in ('platform', 'office')),
  scope_id uuid,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, role, scope_type, scope_id)
);

-- Role helpers (§5). They live here, not in 0001, because a SQL-language
-- function body is validated at creation time and these read `memberships`.
create or replace function public.has_role(roles public.app_role[], scope_kind text default null, scope uuid default null)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid()
      and m.deleted_at is null
      and m.role = any (roles)
      and (scope_kind is null or m.scope_type = scope_kind)
      and (scope is null or m.scope_id = scope)
  );
$$;

create or replace function public.is_platform_staff()
returns boolean language sql stable as $$
  select public.has_role(array['platform_support','platform_compliance','platform_admin','platform_superadmin']::public.app_role[]);
$$;

create or replace function public.is_office_member(office uuid)
returns boolean language sql stable as $$
  select public.has_role(array['office_viewer','office_operator','office_finance','office_owner']::public.app_role[], 'office', office);
$$;

create table public.kyc_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  status public.kyc_status not null default 'pending',
  submitted_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles (id),
  second_approver uuid references public.profiles (id),   -- 4-eyes (§6)
  reason text,
  data jsonb not null default '{}'::jsonb,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.kyc_documents (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.kyc_submissions (id),
  kind text not null check (kind in ('passport', 'national_id', 'selfie', 'proof_of_address')),
  storage_path text not null,          -- private bucket, 60s signed URLs (§6)
  mime text not null,
  sha256 text not null,
  ocr jsonb,
  expires_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.sanctions_hits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  list text not null,
  match_score numeric(5,2) not null,
  payload jsonb not null default '{}'::jsonb,
  resolved_by uuid references public.profiles (id),
  resolution text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- updated_at triggers
create trigger t_profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger t_memberships_updated before update on public.memberships for each row execute function public.set_updated_at();
create trigger t_kyc_submissions_updated before update on public.kyc_submissions for each row execute function public.set_updated_at();
create trigger t_kyc_documents_updated before update on public.kyc_documents for each row execute function public.set_updated_at();
create trigger t_sanctions_hits_updated before update on public.sanctions_hits for each row execute function public.set_updated_at();

-- ── RLS (§15: RLS is the source of truth; UI gating is convenience) ─────────
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.kyc_submissions enable row level security;
alter table public.kyc_documents enable row level security;
alter table public.sanctions_hits enable row level security;

create policy profiles_self_read on public.profiles
  for select using (id = auth.uid() or public.is_platform_staff());
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid() and frozen_at is null)
  with check (id = auth.uid());

create policy memberships_self_read on public.memberships
  for select using (user_id = auth.uid() or public.is_platform_staff());

create policy kyc_submissions_own on public.kyc_submissions
  for select using (
    user_id = auth.uid()
    or public.has_role(array['platform_compliance','platform_admin','platform_superadmin']::public.app_role[])
  );
create policy kyc_submissions_insert on public.kyc_submissions
  for insert with check (user_id = auth.uid());

-- KYC documents: only compliance-grade roles may read; owners upload.
create policy kyc_documents_read on public.kyc_documents
  for select using (
    public.has_role(array['platform_compliance','platform_admin','platform_superadmin']::public.app_role[])
    or exists (
      select 1 from public.kyc_submissions s
      where s.id = submission_id and s.user_id = auth.uid()
    )
  );
create policy kyc_documents_insert on public.kyc_documents
  for insert with check (
    exists (select 1 from public.kyc_submissions s where s.id = submission_id and s.user_id = auth.uid())
  );

create policy sanctions_hits_staff on public.sanctions_hits
  for select using (
    public.has_role(array['platform_compliance','platform_admin','platform_superadmin']::public.app_role[])
  );
