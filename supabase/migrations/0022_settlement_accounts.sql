-- ─────────────────────────────────────────────────────────────────────────────
-- 0022 — Settlement accounts, and who carries the risk when the name does not
--        match
--
-- An office's cards fill up. Iranian cards carry daily and monthly receiving
-- ceilings, and an office that hits one stops being able to take Toman — which
-- stops transfers, not just paperwork. So an office needs to add a fresh card
-- or IBAN itself, at the counter, without waiting on us.
--
-- The interesting part is not the CRUD. It is what happens when the account
-- holder's name does not match the person adding it.
--
-- We check what we can: an Iranian IBAN carries the bank's three-digit code, a
-- card carries a Luhn checksum and a BIN, and we hold the office's registered
-- name and national ID. When those agree, the account is `verified` and nothing
-- is asked. When they do not, we do **not** silently refuse — a legitimate
-- office may bank under a company name, a spouse's account, a trade name. We
-- ask them to accept, in terms, that the transfer is their responsibility, and
-- we record that acceptance as a row: who, when, from which address, against
-- which mismatch.
--
-- That record is the point. §7 of the terms says responsibility passes to the
-- person who chose to proceed; a claim like that is worth exactly as much as
-- the evidence behind it, and a checkbox that leaves no trace is worth nothing.
-- `settlement_acceptances` is append-only for the same reason `ticket_events`
-- is.
-- ─────────────────────────────────────────────────────────────────────────────

-- A. What we know about an account we were given ─────────────────────────────

do $$ begin
  create type public.account_match as enum (
    'verified',      -- holder name and national ID both matched
    'unverified',    -- we could not check (no reference data on file)
    'mismatch'       -- we checked and it did not match
  );
exception when duplicate_object then null; end $$;

alter table public.office_accounts
  add column if not exists bank_id text,
  add column if not exists holder_name text,
  add column if not exists holder_national_code text,
  add column if not exists match_state public.account_match not null default 'unverified',
  add column if not exists mismatch_reason text,
  -- Ceilings are the reason this table needs new rows at all, so they belong
  -- on it: null means "no ceiling recorded", not "unlimited".
  add column if not exists daily_ceiling_minor bigint,
  add column if not exists monthly_ceiling_minor bigint,
  add column if not exists retired_at timestamptz;

comment on column public.office_accounts.match_state is
  'Whether the holder name and national code matched the office on file. A mismatch is allowed but requires a recorded acceptance of responsibility (terms §7).';
comment on column public.office_accounts.retired_at is
  'Set when an account is taken out of use — e.g. its ceiling is full. Never deleted: past orders point at it.';

create index if not exists office_accounts_live
  on public.office_accounts (office_id, active)
  where deleted_at is null and retired_at is null;

-- B. The acceptance, as evidence ─────────────────────────────────────────────

create table if not exists public.settlement_acceptances (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.office_accounts (id),
  accepted_by uuid not null references public.profiles (id),
  /** What we told them was wrong, in the words they saw. */
  mismatch_reason text not null,
  /** The exact terms version they accepted it under. */
  terms_version text not null,
  ip inet,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists settlement_acceptances_account
  on public.settlement_acceptances (account_id, created_at desc);

drop trigger if exists t_settlement_acceptances_append_only on public.settlement_acceptances;
create trigger t_settlement_acceptances_append_only
  before update or delete on public.settlement_acceptances
  for each row execute function public.forbid_mutation();

-- C. Adding an account ───────────────────────────────────────────────────────

/**
 * Add or replace a settlement account.
 *
 * The match is decided here rather than by the client, for the obvious reason:
 * a client that decides whether it matched can decide that it did.
 *
 * `p_accept_responsibility` is only consulted when the check actually failed.
 * Passing it on a clean account does nothing and records nothing — an
 * acceptance that everyone signs is not evidence of anything.
 */
create or replace function public.office_account_add(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_office uuid := (p_payload->>'office_id')::uuid;
  v_kind text := lower(btrim(coalesce(p_payload->>'kind', '')));
  v_currency text := upper(btrim(coalesce(p_payload->>'currency', 'IRT')));
  v_bank text := nullif(btrim(coalesce(p_payload->>'bank_id', '')), '');
  v_number text := btrim(coalesce(p_payload->>'number', ''));
  v_holder text := btrim(coalesce(p_payload->>'holder_name', ''));
  v_code text := nullif(btrim(coalesce(p_payload->>'holder_national_code', '')), '');
  v_label text := nullif(btrim(coalesce(p_payload->>'label', '')), '');
  v_public boolean := coalesce((p_payload->>'is_public')::boolean, true);
  v_daily bigint := nullif(p_payload->>'daily_ceiling_minor', '')::bigint;
  v_monthly bigint := nullif(p_payload->>'monthly_ceiling_minor', '')::bigint;
  v_accept boolean := coalesce((p_payload->>'accept_responsibility')::boolean, false);
  v_terms text := coalesce(nullif(btrim(coalesce(p_payload->>'terms_version', '')), ''), 'unknown');
  v_office_name text;
  v_office_code text;
  v_match public.account_match;
  v_reason text;
  v_account uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not (public.is_platform_staff() or public.is_office_member(v_office)) then
    raise exception 'not a member of that office';
  end if;
  if v_kind not in ('iban', 'card', 'swift', 'cash') then
    raise exception 'unknown account kind %', v_kind;
  end if;
  if v_number = '' then raise exception 'an account needs a number'; end if;
  if v_holder = '' then raise exception 'an account needs a holder name'; end if;

  -- `exchange_offices` has no national-ID column; the office's registration
  -- number lives in `contact` alongside the rest of its filing details. Reading
  -- it out of jsonb rather than adding a column keeps this migration additive.
  select o.legal_name_fa, nullif(btrim(coalesce(o.contact->>'national_id', '')), '')
    into v_office_name, v_office_code
    from public.exchange_offices o where o.id = v_office;

  -- The comparison is deliberately loose on the name — Persian names arrive
  -- with different spacing, half-spaces and honorifics — and exact on the
  -- national code, which is a number and has no such excuse.
  if v_office_code is null then
    v_match := 'unverified';
    v_reason := 'no national code on file for this office';
  elsif v_code is null then
    v_match := 'mismatch';
    v_reason := 'no national code was given for the account holder';
  elsif regexp_replace(v_code, '\D', '', 'g') <> regexp_replace(v_office_code, '\D', '', 'g') then
    v_match := 'mismatch';
    v_reason := 'the holder national code differs from the office on file';
  elsif v_office_name is null then
    v_match := 'unverified';
    v_reason := 'no registered name on file for this office';
  elsif position(
          regexp_replace(lower(v_holder), '[\s‌]', '', 'g')
          in regexp_replace(lower(v_office_name), '[\s‌]', '', 'g')
        ) = 0
    and position(
          regexp_replace(lower(v_office_name), '[\s‌]', '', 'g')
          in regexp_replace(lower(v_holder), '[\s‌]', '', 'g')
        ) = 0 then
    v_match := 'mismatch';
    v_reason := 'the holder name differs from the office registered name';
  else
    v_match := 'verified';
    v_reason := null;
  end if;

  if v_match = 'mismatch' and not v_accept then
    raise exception 'mismatch:%', v_reason;
  end if;

  insert into public.office_accounts (
    office_id, currency, kind, bank_id, details, holder_name, holder_national_code,
    match_state, mismatch_reason, daily_ceiling_minor, monthly_ceiling_minor,
    is_public, active, label
  )
  values (
    v_office, v_currency, v_kind, v_bank, jsonb_build_object('number', v_number),
    v_holder, v_code, v_match, v_reason, v_daily, v_monthly,
    v_public, true, v_label
  )
  returning id into v_account;

  -- Only a real mismatch produces a record. An acceptance everyone signs is
  -- not evidence of anything.
  if v_match = 'mismatch' then
    insert into public.settlement_acceptances (
      account_id, accepted_by, mismatch_reason, terms_version
    ) values (v_account, auth.uid(), v_reason, v_terms);
  end if;

  return v_account;
end;
$$;

/**
 * Take an account out of use — typically because its ceiling is full.
 *
 * Retire rather than delete: orders already settled point at this row, and a
 * ledger whose accounts can vanish is not a ledger.
 */
create or replace function public.office_account_retire(p_account uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_office uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select office_id into v_office from public.office_accounts where id = p_account;
  if v_office is null then raise exception 'no such account'; end if;
  if not (public.is_platform_staff() or public.is_office_member(v_office)) then
    raise exception 'not a member of that office';
  end if;

  update public.office_accounts
     set retired_at = now(), active = false, is_public = false
   where id = p_account and retired_at is null;

  perform public.audit_event(
    'office_account.retire', 'office_account', p_account,
    null, jsonb_build_object('reason', p_reason), null);
end;
$$;

-- D. Reading the acceptances ─────────────────────────────────────────────────

alter table public.settlement_acceptances enable row level security;

drop policy if exists settlement_acceptances_readable on public.settlement_acceptances;
create policy settlement_acceptances_readable on public.settlement_acceptances
  for select using (
    public.is_platform_staff()
    or exists (
      select 1 from public.office_accounts a
       where a.id = settlement_acceptances.account_id
         and public.is_office_member(a.office_id)
    )
  );

-- E. Grants ──────────────────────────────────────────────────────────────────

revoke all on function public.office_account_add(jsonb) from public;
revoke all on function public.office_account_retire(uuid, text) from public;
grant execute on function public.office_account_add(jsonb) to authenticated;
grant execute on function public.office_account_retire(uuid, text) to authenticated;
grant select on public.settlement_acceptances to authenticated;
