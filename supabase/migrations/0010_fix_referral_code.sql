-- ─────────────────────────────────────────────────────────────────────────────
-- Sign-up was broken, and had been since 0007.
--
-- handle_new_user() called pgcrypto's gen_random_bytes() unqualified. Migration
-- 0007 pinned every owned function's search_path to `public` — but pgcrypto is
-- installed in `extensions`, so the call stopped resolving and the trigger on
-- auth.users raised. Every sign-up failed inside the transaction that creates
-- the user, which is why auth.users still held zero rows: the fault was
-- invisible until someone actually completed a sign-in, and the phone path was
-- reporting `sms_channel_unavailable` long before it got that far.
--
-- The fix drops the extension dependency rather than widening the search_path
-- or schema-qualifying the call: random() and the loop below are core, so this
-- keeps working on a host that puts pgcrypto elsewhere, or omits it.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.gen_referral_code()
returns text language plpgsql volatile set search_path = public as $$
declare
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  candidate text;
  attempts int := 0;
begin
  loop
    candidate := (
      select string_agg(substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1), '')
      from generate_series(1, 8)
    );
    exit when not exists (select 1 from public.profiles where referral_code = candidate);
    attempts := attempts + 1;
    -- 32^8 codes; if this ever trips, the space is not the problem.
    if attempts > 20 then
      raise exception 'could not allocate a referral code after % attempts', attempts;
    end if;
  end loop;
  return candidate;
end $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, phone, email, referral_code, phone_verified_at)
  values (
    new.id,
    new.phone,
    new.email,
    public.gen_referral_code(),
    new.phone_confirmed_at
  )
  on conflict (id) do nothing;
  return new;
end $$;

revoke execute on function public.gen_referral_code() from anon, authenticated;
revoke execute on function public.handle_new_user() from anon, authenticated;
