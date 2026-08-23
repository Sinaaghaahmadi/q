-- ─────────────────────────────────────────────────────────────────────────────
-- 0023 — Check the account number in the database, not only in the browser
--
-- 0022 decided the *holder* server-side, for the obvious reason: a client that
-- decides whether the name matched can decide that it did. It then took the
-- account number on trust, which is the same mistake one field to the left.
--
-- The settlement screen validates a card's Luhn checksum and a sheba's mod-97
-- before it will enable the button, so in practice nothing malformed reaches
-- here. But "in practice" is doing all the work in that sentence: the RPC is
-- reachable by any authenticated office member with a terminal, and a card
-- number that is one digit wrong is not a validation nicety — it is a transfer
-- that leaves and does not arrive.
--
-- So the checks move where they cannot be skipped. The client keeps its copy,
-- because telling someone their card is wrong while they are still typing is
-- worth far more than telling them after a round trip.
-- ─────────────────────────────────────────────────────────────────────────────

/**
 * Luhn checksum, the one Iranian bank cards carry in their sixteenth digit.
 */
create or replace function public.luhn_ok(p_digits text)
returns boolean
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_sum int := 0;
  v_alt boolean := false;
  v_n int;
  i int;
begin
  if p_digits !~ '^\d+$' then return false; end if;
  for i in reverse length(p_digits)..1 loop
    v_n := (substr(p_digits, i, 1))::int;
    if v_alt then
      v_n := v_n * 2;
      if v_n > 9 then v_n := v_n - 9; end if;
    end if;
    v_sum := v_sum + v_n;
    v_alt := not v_alt;
  end loop;
  return v_sum % 10 = 0;
end;
$$;

/**
 * ISO 13616 mod-97, chunked so an IBAN of any length stays inside bigint.
 *
 * The whole number does not fit in any integer type — a 26-character Iranian
 * sheba becomes a 28-digit integer once `IR` is expanded — so it is folded
 * seven digits at a time, which is exactly what the standard prescribes.
 */
create or replace function public.iban_ok(p_iban text)
returns boolean
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_iban text := upper(regexp_replace(coalesce(p_iban, ''), '[\s-]', '', 'g'));
  v_rearranged text;
  v_numeric text := '';
  v_ch text;
  v_rem int := 0;
  i int;
begin
  if v_iban !~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]+$' then return false; end if;
  if length(v_iban) < 15 or length(v_iban) > 34 then return false; end if;

  v_rearranged := substr(v_iban, 5) || substr(v_iban, 1, 4);
  for i in 1..length(v_rearranged) loop
    v_ch := substr(v_rearranged, i, 1);
    if v_ch ~ '[A-Z]' then
      v_numeric := v_numeric || (ascii(v_ch) - 55)::text;
    else
      v_numeric := v_numeric || v_ch;
    end if;
  end loop;

  i := 1;
  while i <= length(v_numeric) loop
    v_rem := (v_rem::text || substr(v_numeric, i, 7))::bigint % 97;
    i := i + 7;
  end loop;
  return v_rem = 1;
end;
$$;

/** An Iranian sheba: IR and 24 digits, mod-97 valid. */
create or replace function public.sheba_ok(p_input text)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when upper(regexp_replace(coalesce(p_input, ''), '[\s-]', '', 'g')) !~ '^IR[0-9]{24}$'
      then false
    else public.iban_ok(p_input)
  end;
$$;

/**
 * Iranian national code: ten digits, mod-11 check digit.
 *
 * Mirrors `validateNationalCode` in `src/lib/validators/national-code.ts`
 * exactly, all-identical digits included — those pass the checksum but are
 * never issued, and letting them through would make "0000000000" a valid
 * holder identity.
 */
create or replace function public.national_code_ok(p_code text)
returns boolean
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_code text := regexp_replace(coalesce(p_code, ''), '[\s-]', '', 'g');
  v_sum int := 0;
  v_rem int;
  v_check int;
  i int;
begin
  if v_code !~ '^\d{10}$' then return false; end if;
  if v_code ~ '^(\d)\1{9}$' then return false; end if;

  v_check := substr(v_code, 10, 1)::int;
  for i in 1..9 loop
    v_sum := v_sum + substr(v_code, i, 1)::int * (11 - i);
  end loop;
  v_rem := v_sum % 11;
  return case when v_rem < 2 then v_check = v_rem else v_check = 11 - v_rem end;
end;
$$;

-- ── Fold the checks into office_account_add ─────────────────────────────────
-- Replaced whole rather than patched: a function is not a diff, and half of one
-- deployed by mistake is worse than none.

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

  -- The number has to be a number that exists. A card whose checksum fails is
  -- a typo, and a typo here is money leaving for an account that is not there.
  if v_kind = 'card' then
    if v_number !~ '^[0-9]{16}$' or not public.luhn_ok(v_number) then
      raise exception 'that card number is not valid';
    end if;
  elsif v_kind = 'iban' then
    -- Iranian offices settle in sheba; a foreign IBAN is still allowed for
    -- non-Toman accounts, so the tighter rule only applies to IR.
    if v_number like 'IR%' then
      if not public.sheba_ok(v_number) then
        raise exception 'that sheba number is not valid';
      end if;
    elsif not public.iban_ok(v_number) then
      raise exception 'that IBAN is not valid';
    end if;
  end if;

  -- A national code that is present must also be a real one, for the same
  -- reason: the match below compares it, and comparing two typos is not a check.
  if v_code is not null and not public.national_code_ok(v_code) then
    raise exception 'that national code is not valid';
  end if;

  select o.legal_name_fa, nullif(btrim(coalesce(o.contact->>'national_id', '')), '')
    into v_office_name, v_office_code
    from public.exchange_offices o where o.id = v_office;

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
revoke all on function public.luhn_ok(text) from public;
revoke all on function public.iban_ok(text) from public;
revoke all on function public.sheba_ok(text) from public;
revoke all on function public.national_code_ok(text) from public;
grant execute on function public.luhn_ok(text) to authenticated;
grant execute on function public.iban_ok(text) to authenticated;
grant execute on function public.sheba_ok(text) to authenticated;
grant execute on function public.national_code_ok(text) to authenticated;
