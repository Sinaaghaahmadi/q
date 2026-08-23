-- ─────────────────────────────────────────────────────────────────────────────
-- 0024 — The administrator owns identity, and an office has a face
--
-- Three things, all asked for together because they are the same change: the
-- platform administrator decides who is verified.
--
-- 1. KYC approval no longer needs a second pair of eyes *when an administrator
--    makes it*. That is a real weakening of a real control and it is worth
--    saying why it is safe enough: four-eyes on a customer KYC decision exists
--    to stop one compliance officer waving through an account. An administrator
--    already holds `order_force_transition` and `impersonation_start`; someone
--    who can move money and act as any office is not meaningfully restrained by
--    needing a colleague to co-sign an identity check. So compliance officers
--    keep four-eyes, administrators do not, and — this is the part that matters
--    — the record always says which of the two happened. A decision made alone
--    is stamped `sole_decision` in the audit log and carries the same actor in
--    both approver columns, so "was anyone else involved" is answerable from
--    the row rather than from memory.
--
-- 2. An office gets its own identity check, which never existed. `status` is a
--    lifecycle (draft → active → suspended), not a statement about whether we
--    believe who they are. The two are now separate, and the second is the
--    administrator's to decide.
--
-- 3. An office gets the details that check is *against* — registered owner,
--    national code, phone — as columns rather than loose keys in `contact`.
--    `office_account_add` compares against these, so they stopped being
--    incidental the moment settlement shipped.
-- ─────────────────────────────────────────────────────────────────────────────

-- A. What we hold about an office ────────────────────────────────────────────

do $$ begin
  create type public.office_kyc as enum ('unverified', 'pending', 'verified', 'rejected');
exception when duplicate_object then null; end $$;

alter table public.exchange_offices
  add column if not exists display_name text,
  add column if not exists owner_name text,
  add column if not exists national_id text,
  add column if not exists owner_phone text,
  add column if not exists logo_path text,
  add column if not exists kyc_state public.office_kyc not null default 'unverified',
  add column if not exists kyc_reason text,
  add column if not exists kyc_decided_by uuid references public.profiles (id),
  add column if not exists kyc_decided_at timestamptz;

comment on column public.exchange_offices.display_name is
  'The short name customers see. The legal names stay for contracts and receipts; nobody wants "شرکت صرافی آسا تهران (سهامی خاص)" on a rate card.';
comment on column public.exchange_offices.kyc_state is
  'Whether the platform has verified who this office is. Separate from `status`, which is a lifecycle: an office can be active and unverified, or verified and suspended.';
comment on column public.exchange_offices.logo_path is
  'Object path in the `office-logos` bucket. Null means the office shows its initial instead, which is a perfectly good logo.';

-- Backfill from where these values have been living: `contact` jsonb for the
-- identity fields, and the Persian legal name for the display name. Existing
-- offices should not be worse off for having been created before the columns.
update public.exchange_offices
   set display_name = coalesce(display_name, legal_name_fa),
       national_id = coalesce(national_id, nullif(btrim(coalesce(contact->>'national_id', '')), '')),
       owner_phone = coalesce(owner_phone, nullif(btrim(coalesce(contact->>'phone', '')), ''))
 where display_name is null or national_id is null or owner_phone is null;

-- B. The office's identity check, decided by an administrator ────────────────

/**
 * Verify, reject or re-open an office's identity.
 *
 * A rejection needs a written reason for the same reason suspending an office
 * does: the office will ask, and "the system said no" is not an answer anyone
 * can act on.
 */
create or replace function public.admin_decide_office_kyc(
  p_office uuid,
  p_decision public.office_kyc,
  p_reason text default null
) returns public.office_kyc
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_before public.office_kyc;
begin
  if not public.has_role(array['platform_admin','platform_superadmin']::public.app_role[]) then
    raise exception 'only a platform administrator may decide an office identity check';
  end if;

  select kyc_state into v_before from public.exchange_offices
   where id = p_office and deleted_at is null;
  if v_before is null then raise exception 'exchange office not found'; end if;

  if p_decision = 'rejected' and coalesce(length(btrim(coalesce(p_reason, ''))), 0) < 8 then
    raise exception 'rejecting an office identity check requires a written reason';
  end if;

  perform set_config('asaex.reason', coalesce(p_reason, 'office identity decided'), true);
  update public.exchange_offices
     set kyc_state = p_decision,
         kyc_reason = p_reason,
         kyc_decided_by = auth.uid(),
         kyc_decided_at = now()
   where id = p_office;

  perform public.audit_event(
    'office.kyc', 'exchange_offices', p_office,
    jsonb_build_object('kyc_state', v_before),
    jsonb_build_object('kyc_state', p_decision),
    p_reason);

  return p_decision;
end;
$$;

/**
 * Edit an office's own details, including the ones settlement matches against.
 *
 * Only the fields present in the payload move — a partial edit from one screen
 * must not blank the fields another screen owns.
 */
create or replace function public.admin_update_office(p_office uuid, p_patch jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_before jsonb;
begin
  if not (public.has_role(array['platform_admin','platform_superadmin']::public.app_role[])
          or public.has_role(array['office_owner']::public.app_role[], 'office', p_office)) then
    raise exception 'only a platform administrator or the office owner may edit an office';
  end if;

  -- An office owner may rename their own shop and change its logo. It may not
  -- edit the identity the platform verified it against; that is the whole point
  -- of having verified it.
  if not public.has_role(array['platform_admin','platform_superadmin']::public.app_role[])
     and (p_patch ? 'national_id' or p_patch ? 'owner_name' or p_patch ? 'license_no') then
    raise exception 'only a platform administrator may change verified identity details';
  end if;

  if p_patch ? 'national_id'
     and nullif(btrim(coalesce(p_patch->>'national_id', '')), '') is not null
     and not public.national_code_ok(p_patch->>'national_id') then
    raise exception 'that national code is not valid';
  end if;

  select to_jsonb(e) into v_before from public.exchange_offices e where e.id = p_office;
  if v_before is null then raise exception 'exchange office not found'; end if;

  perform set_config('asaex.reason', coalesce(p_patch->>'reason', 'office details edited'), true);

  update public.exchange_offices set
    display_name  = case when p_patch ? 'display_name'
                    then nullif(btrim(coalesce(p_patch->>'display_name', '')), '') else display_name end,
    legal_name_fa = case when p_patch ? 'legal_name_fa'
                    then coalesce(nullif(btrim(coalesce(p_patch->>'legal_name_fa','')),''), legal_name_fa)
                    else legal_name_fa end,
    legal_name_en = case when p_patch ? 'legal_name_en'
                    then coalesce(nullif(btrim(coalesce(p_patch->>'legal_name_en','')),''), legal_name_en)
                    else legal_name_en end,
    license_no    = case when p_patch ? 'license_no'
                    then coalesce(nullif(btrim(coalesce(p_patch->>'license_no','')),''), license_no)
                    else license_no end,
    owner_name    = case when p_patch ? 'owner_name'
                    then nullif(btrim(coalesce(p_patch->>'owner_name', '')), '') else owner_name end,
    national_id   = case when p_patch ? 'national_id'
                    then nullif(btrim(coalesce(p_patch->>'national_id', '')), '') else national_id end,
    owner_phone   = case when p_patch ? 'owner_phone'
                    then nullif(btrim(coalesce(p_patch->>'owner_phone', '')), '') else owner_phone end,
    logo_path     = case when p_patch ? 'logo_path'
                    then nullif(btrim(coalesce(p_patch->>'logo_path', '')), '') else logo_path end,
    city          = case when p_patch ? 'city'
                    then nullif(btrim(coalesce(p_patch->>'city', '')), '') else city end,
    branding      = case when p_patch ? 'branding'
                    then coalesce(branding, '{}'::jsonb) || (p_patch->'branding') else branding end,
    contact       = case when p_patch ? 'contact'
                    then coalesce(contact, '{}'::jsonb) || (p_patch->'contact') else contact end
  where id = p_office;

  perform public.audit_event(
    'office.update', 'exchange_offices', p_office, v_before,
    to_jsonb((select e from public.exchange_offices e where e.id = p_office)),
    p_patch->>'reason');
end;
$$;

-- C. Settlement matches the column, not the jsonb ────────────────────────────
-- `office_account_add` read `contact->>'national_id'` because that was the only
-- place the value lived. Now that it is a column with a validator behind it,
-- read that, and keep the jsonb as a fallback for a row nobody has re-saved.

create or replace function public.office_identity(p_office uuid)
returns table (registered_name text, national_code text)
language sql
stable
set search_path = public, pg_temp
as $$
  select
    coalesce(nullif(btrim(coalesce(o.owner_name, '')), ''), o.legal_name_fa),
    coalesce(
      nullif(btrim(coalesce(o.national_id, '')), ''),
      nullif(btrim(coalesce(o.contact->>'national_id', '')), '')
    )
  from public.exchange_offices o
  where o.id = p_office;
$$;

-- D. KYC: an administrator may decide alone ──────────────────────────────────

create or replace function public.kyc_decide(
  p_submission uuid,
  p_decision public.kyc_status,
  p_reason text default null
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_admin boolean := public.has_role(array['platform_admin','platform_superadmin']::public.app_role[]);
  v_row public.kyc_submissions;
  v_sole boolean := false;
begin
  if not (v_admin or public.has_role(array['platform_compliance']::public.app_role[])) then
    raise exception 'not authorised to decide KYC';
  end if;

  select * into v_row from public.kyc_submissions where id = p_submission for update;
  if v_row.id is null then
    raise exception 'submission % not found', p_submission;
  end if;

  -- A compliance officer still needs a first reviewer and still may not be
  -- that reviewer. An administrator may do both, and the row says so.
  if not v_admin then
    if v_row.recommended_by is null then
      raise exception 'submission % needs a first-reviewer recommendation before approval', p_submission;
    end if;
    if v_row.recommended_by = v_actor then
      raise exception 'four-eyes: the recommending reviewer cannot also approve';
    end if;
  else
    v_sole := v_row.recommended_by is null or v_row.recommended_by = v_actor;
  end if;

  update public.kyc_submissions
     set status = p_decision,
         decided_at = now(),
         decided_by = coalesce(v_row.recommended_by, v_actor),
         second_approver = v_actor,
         reason = coalesce(p_reason, reason)
   where id = p_submission;

  update public.profiles set kyc_status = p_decision where id = v_row.user_id;

  insert into public.audit_log (
    actor_id, actor_role, action, entity_type, entity_id, before, after, reason
  ) values (
    v_actor,
    case when v_admin then 'platform_admin' else 'platform_compliance' end,
    'kyc.decide', 'kyc_submission', p_submission,
    jsonb_build_object('status', v_row.status),
    jsonb_build_object(
      'status', p_decision,
      'first_reviewer', v_row.recommended_by,
      -- The one fact that four-eyes used to guarantee, now recorded instead of
      -- enforced: whether a second person was involved at all.
      'sole_decision', v_sole),
    p_reason);
end;
$$;

-- E. The office's first sign-in ──────────────────────────────────────────────
-- An office provisioned by an administrator arrives with a password it did not
-- choose. It should be offered the chance to change it, once, and be allowed to
-- decline — an operator who is forced into a password dialogue on a busy
-- morning picks something worse than what was generated for them.

alter table public.profiles
  add column if not exists password_set_by_user boolean not null default true;

comment on column public.profiles.password_set_by_user is
  'False while the account is still on the password it was provisioned with. Drives the one-time offer to choose their own; declining is allowed and clears it too.';

/**
 * Mark that the account has settled its password question — either by choosing
 * a new one or by declining to. Both clear the prompt; only the caller's own
 * row is touched, so this needs no role check beyond being signed in.
 */
create or replace function public.password_choice_settled()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  update public.profiles set password_set_by_user = true where id = auth.uid();
end;
$$;

-- F. Grants ──────────────────────────────────────────────────────────────────

revoke all on function public.admin_decide_office_kyc(uuid, public.office_kyc, text) from public;
revoke all on function public.admin_update_office(uuid, jsonb) from public;
revoke all on function public.office_identity(uuid) from public;
revoke all on function public.password_choice_settled() from public;
grant execute on function public.admin_decide_office_kyc(uuid, public.office_kyc, text) to authenticated;
grant execute on function public.admin_update_office(uuid, jsonb) to authenticated;
grant execute on function public.office_identity(uuid) to authenticated;
grant execute on function public.password_choice_settled() to authenticated;
grant execute on function public.kyc_decide(uuid, public.kyc_status, text) to authenticated;
