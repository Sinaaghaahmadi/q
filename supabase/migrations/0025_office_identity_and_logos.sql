-- ─────────────────────────────────────────────────────────────────────────────
-- 0025 — Settlement matches the verified identity, and an office gets a logo
--
-- Two loose ends from 0024.
--
-- `office_account_add` compares a settlement account's holder against the
-- office on file, and "on file" meant `contact->>'national_id'` because that
-- was the only place it lived. 0024 gave it a column with a checksum behind it
-- and an administrator who verifies it. The comparison should be against that.
--
-- And an office needs somewhere to put its logo. Public-read, because a logo
-- that customers cannot see is not a logo; written only by the office itself or
-- an administrator, because a bucket anyone can write to is a bucket someone
-- will host something else in.
-- ─────────────────────────────────────────────────────────────────────────────

-- A. Match against the verified identity ─────────────────────────────────────

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
  v_number text := upper(regexp_replace(coalesce(p_payload->>'number', ''), '[\s-]', '', 'g'));
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

  if v_kind = 'card' then
    if v_number !~ '^[0-9]{16}$' or not public.luhn_ok(v_number) then
      raise exception 'that card number is not valid';
    end if;
  elsif v_kind = 'iban' then
    if v_number like 'IR%' then
      if not public.sheba_ok(v_number) then
        raise exception 'that sheba number is not valid';
      end if;
    elsif not public.iban_ok(v_number) then
      raise exception 'that IBAN is not valid';
    end if;
  end if;

  if v_code is not null and not public.national_code_ok(v_code) then
    raise exception 'that national code is not valid';
  end if;

  -- The registered owner and national code an administrator verified, falling
  -- back to the legal name and the old `contact` key for an office nobody has
  -- re-saved since 0024.
  select registered_name, national_code into v_office_name, v_office_code
    from public.office_identity(v_office);

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

  if v_match = 'mismatch' then
    insert into public.settlement_acceptances (
      account_id, accepted_by, mismatch_reason, terms_version
    ) values (v_account, auth.uid(), v_reason, v_terms);
  end if;

  return v_account;
end;
$$;

revoke all on function public.office_account_add(jsonb) from public;
grant execute on function public.office_account_add(jsonb) to authenticated;

-- B. Somewhere to keep the logo ──────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'office-logos', 'office-logos', true, 524288,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update
  set public = true,
      file_size_limit = 524288,
      allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

-- Public read: a logo appears next to the office on the rate board and on a
-- customer's order, both of which are reachable signed out.
drop policy if exists office_logos_public_read on storage.objects;
create policy office_logos_public_read on storage.objects
  for select using (bucket_id = 'office-logos');

-- Written only by that office's own people or an administrator. The first path
-- segment is the office id, which is what ties an upload to a membership.
drop policy if exists office_logos_write on storage.objects;
create policy office_logos_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'office-logos'
    and (
      public.has_role(array['platform_admin','platform_superadmin']::public.app_role[])
      or public.has_role(
           array['office_owner']::public.app_role[], 'office',
           nullif(split_part(name, '/', 1), '')::uuid)
    )
  );

drop policy if exists office_logos_replace on storage.objects;
create policy office_logos_replace on storage.objects
  for update to authenticated
  using (
    bucket_id = 'office-logos'
    and (
      public.has_role(array['platform_admin','platform_superadmin']::public.app_role[])
      or public.has_role(
           array['office_owner']::public.app_role[], 'office',
           nullif(split_part(name, '/', 1), '')::uuid)
    )
  );

drop policy if exists office_logos_delete on storage.objects;
create policy office_logos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'office-logos'
    and (
      public.has_role(array['platform_admin','platform_superadmin']::public.app_role[])
      or public.has_role(
           array['office_owner']::public.app_role[], 'office',
           nullif(split_part(name, '/', 1), '')::uuid)
    )
  );
