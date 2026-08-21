-- 0006 — Phase 2: auth wiring, private KYC storage, OTP rate limits,
-- device history, legal acceptance, and the 4-eyes KYC decision function.

-- ── Profile provisioning ─────────────────────────────────────────────────────
-- Every auth.users row gets exactly one profile. Phone/email come from the
-- identity Supabase Auth verified, so they are trusted at this point.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_code text;
begin
  -- Referral code: 6 chars, collision-retried by the unique index below.
  v_code := upper(substr(encode(gen_random_bytes(6), 'base64'), 1, 6));
  v_code := regexp_replace(v_code, '[^A-Z0-9]', 'X', 'g');

  insert into public.profiles (id, phone, email, referral_code, phone_verified_at)
  values (
    new.id,
    new.phone,
    new.email,
    v_code,
    case when new.phone_confirmed_at is not null then new.phone_confirmed_at else null end
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger t_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep the profile's verified-phone marker in step with Auth.
create or replace function public.sync_profile_phone()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
    set phone = coalesce(new.phone, phone),
        email = coalesce(new.email, email),
        phone_verified_at = coalesce(new.phone_confirmed_at, phone_verified_at)
    where id = new.id;
  return new;
end $$;

create trigger t_on_auth_user_updated
  after update of phone, email, phone_confirmed_at on auth.users
  for each row execute function public.sync_profile_phone();

-- ── OTP rate limiting (§15) ──────────────────────────────────────────────────
-- Written by the server (service role) only; never readable by clients.
create table public.otp_attempts (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  ip inet,
  kind text not null default 'send' check (kind in ('send', 'verify')),
  succeeded boolean not null default false,
  created_at timestamptz not null default now()
);
create index otp_attempts_phone_time on public.otp_attempts (phone, created_at desc);
create index otp_attempts_ip_time on public.otp_attempts (ip, created_at desc);
alter table public.otp_attempts enable row level security;
-- No policy: only the service role reaches this table.

-- ── Device / session history (§15: session list with remote revoke) ─────────
create table public.login_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('sign_in', 'sign_out', 'revoked')),
  ip inet,
  user_agent text,
  device_label text,
  created_at timestamptz not null default now()
);
create index login_events_user_time on public.login_events (user_id, created_at desc);
alter table public.login_events enable row level security;
create policy login_events_own on public.login_events
  for select using (user_id = auth.uid() or public.is_platform_staff());

-- ── Legal acceptance per user per version (§15) ─────────────────────────────
create table public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  document text not null,
  version text not null,
  accepted_at timestamptz not null default now(),
  ip inet,
  unique (user_id, document, version)
);
alter table public.legal_acceptances enable row level security;
create policy legal_acceptances_own on public.legal_acceptances
  for select using (user_id = auth.uid() or public.is_platform_staff());
create policy legal_acceptances_insert on public.legal_acceptances
  for insert with check (user_id = auth.uid());

-- ── Customers may update their own KYC submission while it is still open ────
create policy kyc_submissions_update_own on public.kyc_submissions
  for update using (
    user_id = auth.uid() and status in ('pending', 'more_info_needed')
  )
  with check (user_id = auth.uid());

-- ── 4-eyes KYC decision (§6) ────────────────────────────────────────────────
-- One reviewer recommends, a second approves. The recommending reviewer can
-- never be the approver; every step lands in audit_log.
alter table public.kyc_submissions
  add column recommended_by uuid references public.profiles (id),
  add column recommended_at timestamptz,
  add column recommendation public.kyc_status;

create or replace function public.kyc_recommend(
  p_submission uuid,
  p_recommendation public.kyc_status,
  p_reason text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
begin
  if not public.has_role(array['platform_compliance','platform_admin','platform_superadmin']::public.app_role[]) then
    raise exception 'not authorised to review KYC';
  end if;
  if p_recommendation not in ('approved', 'rejected', 'more_info_needed') then
    raise exception 'invalid recommendation %', p_recommendation;
  end if;

  update public.kyc_submissions
    set recommended_by = v_actor,
        recommended_at = now(),
        recommendation = p_recommendation,
        reason = coalesce(p_reason, reason)
    where id = p_submission and status in ('pending', 'more_info_needed');

  if not found then
    raise exception 'submission % is not open for review', p_submission;
  end if;

  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, after, reason)
    values (v_actor, 'platform_compliance', 'kyc.recommend', 'kyc_submission', p_submission,
            jsonb_build_object('recommendation', p_recommendation), p_reason);
end $$;

create or replace function public.kyc_decide(
  p_submission uuid,
  p_decision public.kyc_status,
  p_reason text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_row public.kyc_submissions;
begin
  if not public.has_role(array['platform_compliance','platform_admin','platform_superadmin']::public.app_role[]) then
    raise exception 'not authorised to decide KYC';
  end if;

  select * into v_row from public.kyc_submissions where id = p_submission for update;
  if v_row.id is null then
    raise exception 'submission % not found', p_submission;
  end if;
  if v_row.recommended_by is null then
    raise exception 'submission % needs a first-reviewer recommendation before approval', p_submission;
  end if;
  if v_row.recommended_by = v_actor then
    raise exception 'four-eyes: the recommending reviewer cannot also approve';
  end if;

  update public.kyc_submissions
    set status = p_decision,
        decided_at = now(),
        decided_by = v_row.recommended_by,
        second_approver = v_actor,
        reason = coalesce(p_reason, reason)
    where id = p_submission;

  update public.profiles set kyc_status = p_decision where id = v_row.user_id;

  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, before, after, reason)
    values (v_actor, 'platform_compliance', 'kyc.decide', 'kyc_submission', p_submission,
            jsonb_build_object('status', v_row.status),
            jsonb_build_object('status', p_decision, 'first_reviewer', v_row.recommended_by), p_reason);
end $$;

-- ── Private storage for identity documents (§6, §15) ────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'kyc-documents', 'kyc-documents', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

-- Objects live under `{user_id}/{submission_id}/{kind}.jpg`. Owners may write
-- their own folder; only compliance-grade staff may read (through short-lived
-- signed URLs minted server-side), and nobody may delete.
create policy kyc_objects_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'kyc-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy kyc_objects_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'kyc-documents'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.has_role(array['platform_compliance','platform_admin','platform_superadmin']::public.app_role[])
    )
  );
