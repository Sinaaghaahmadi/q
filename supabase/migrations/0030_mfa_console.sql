-- ─────────────────────────────────────────────────────────────────────────────
-- 0030 — The second-factor console, and a hole in the one it was built on
--
-- Two things, both about `require_staff_mfa`.
--
-- **The leak.** 0028 shipped `staff_mfa_coverage()` as SECURITY DEFINER granted
-- to `authenticated`, with no check on who is asking. It reads `auth.mfa_factors`,
-- which is exactly why it needed definer rights — and definer rights are why the
-- gate had to be written inside it, which it was not. Any signed-in customer
-- could call it and receive every platform staff member's name, their roles, and
-- which of them have no second factor. That last column turns a staff list into
-- a target list: it names the administrator worth phishing. Verified against the
-- live database before writing this, as `role authenticated` with no `auth.uid()`
-- at all, and it returned the full roster.
--
-- **The switch.** 0028 also left `require_staff_mfa` off, for a reason it stated:
-- turning it on while accounts have no factor locks every one of them out at
-- once, including the only administrator who could turn it back off. `settings`
-- is writable by any platform admin through `settings_admin_write`, so that
-- mistake is one toggle away and is not reversible from inside the app. The
-- guard belongs here rather than in the console, because the console is not the
-- only way to reach that row.
--
-- Turning the switch *off* is never blocked. A safety catch you cannot release
-- is a worse failure than the one it prevents.
-- ─────────────────────────────────────────────────────────────────────────────

-- A. Close the leak ──────────────────────────────────────────────────────────

/**
 * Second-factor coverage across staff, for the console.
 *
 * Same shape and same purpose as 0028's; what is new is the first three lines
 * of the body. The gate is `has_role` on the two administrative seats rather
 * than `is_platform_staff()`, which would have admitted every support seat: a
 * colleague who cannot act on this list has no reason to hold it.
 *
 * Under an enforced requirement `has_role` itself depends on `mfa_satisfied()`,
 * so an administrator who has not used their factor this session cannot read
 * the roster either. That is the same rule the rest of the console follows, and
 * it cannot strand anybody: the switch below refuses to turn on while a single
 * staff account is still un-enrolled.
 */
create or replace function public.staff_mfa_coverage()
returns table (user_id uuid, full_name text, roles text[], enrolled boolean)
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if not public.has_role(array['platform_admin','platform_superadmin']::public.app_role[]) then
    raise exception 'not permitted';
  end if;

  return query
  select p.id,
         coalesce(nullif(btrim(coalesce(p.full_name_fa, '')), ''), p.full_name_latin, p.email),
         array_agg(distinct m.role::text order by m.role::text),
         exists (select 1 from auth.mfa_factors f
                  where f.user_id = p.id and f.status = 'verified')
    from public.profiles p
    join public.memberships m
      on m.user_id = p.id and m.scope_type = 'platform' and m.deleted_at is null
   where p.deleted_at is null
   group by p.id, p.full_name_fa, p.full_name_latin, p.email;
end;
$$;

-- B. The switch, guarded ─────────────────────────────────────────────────────

/**
 * Set the platform-wide second-factor requirement.
 *
 * SECURITY DEFINER because it reads `auth.mfa_factors`. The role check is
 * explicit rather than inherited from `settings_admin_write`: definer rights
 * bypass the policy, so the gate has to be restated here or this function would
 * itself be the way around it — which is the mistake fixed in section A.
 *
 * The refusal names the accounts. "It did not work" and "these three people
 * have not set up their authenticator yet" are the same fact, and only one of
 * them tells an administrator what to do next.
 */
create or replace function public.staff_mfa_require_set(p_on boolean)
returns boolean
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_missing text[];
  v_before boolean;
begin
  if not public.has_role(array['platform_admin','platform_superadmin']::public.app_role[]) then
    raise exception 'only a platform administrator may change this';
  end if;

  select coalesce((select (value #>> '{}')::boolean from public.settings
                    where key = 'require_staff_mfa'), false)
    into v_before;

  if p_on then
    -- Everyone holding a platform seat who has no verified factor. This asks
    -- about other people, so it reads the roster directly rather than through
    -- `has_role`, which only ever answers about the caller.
    select array_agg(distinct coalesce(
             nullif(btrim(coalesce(p.full_name_fa, '')), ''), p.full_name_latin, p.email))
      into v_missing
      from public.profiles p
      join public.memberships m
        on m.user_id = p.id and m.scope_type = 'platform' and m.deleted_at is null
     where p.deleted_at is null
       and not exists (select 1 from auth.mfa_factors f
                        where f.user_id = p.id and f.status = 'verified');

    if v_missing is not null and array_length(v_missing, 1) > 0 then
      raise exception 'staff without a second factor: %', array_to_string(v_missing, ', ')
        using errcode = 'check_violation';
    end if;
  end if;

  insert into public.settings (key, value)
  values ('require_staff_mfa', to_jsonb(p_on))
  on conflict (key) do update set value = excluded.value;

  perform public.audit_event(
    'settings.require_staff_mfa', 'settings', null,
    jsonb_build_object('require_staff_mfa', v_before),
    jsonb_build_object('require_staff_mfa', p_on),
    null);

  return p_on;
end;
$$;

-- C. One round trip for the screen ───────────────────────────────────────────

/**
 * The switch, the roster, and whether the reader themselves has enrolled.
 *
 * `self_enrolled` is called out separately because the screen's most useful
 * warning is about the person reading it: an administrator with no factor of
 * their own is the one who must not turn the switch on.
 *
 * The gate is `staff_mfa_coverage()`'s, inherited by calling it — one place
 * where the rule is written, so the two cannot come apart.
 */
create or replace function public.staff_mfa_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
declare v_staff jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id', c.user_id,
           'full_name', c.full_name,
           'roles', c.roles,
           'enrolled', c.enrolled)
         order by c.enrolled, c.full_name), '[]'::jsonb)
    into v_staff
    from public.staff_mfa_coverage() c;

  return jsonb_build_object(
    'required', coalesce((select (value #>> '{}')::boolean from public.settings
                           where key = 'require_staff_mfa'), false),
    'self_enrolled', public.has_verified_factor(),
    'staff', v_staff);
end;
$$;

revoke all on function public.staff_mfa_coverage() from public;
revoke all on function public.staff_mfa_require_set(boolean) from public;
revoke all on function public.staff_mfa_state() from public;
grant execute on function public.staff_mfa_coverage() to authenticated;
grant execute on function public.staff_mfa_require_set(boolean) to authenticated;
grant execute on function public.staff_mfa_state() to authenticated;
