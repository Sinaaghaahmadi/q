-- ─────────────────────────────────────────────────────────────────────────────
-- 0028 — A second factor that the database, not the screen, insists on
--
-- §15 asks for TOTP on staff accounts and `docs/launch-checklist.md` lists it as
-- blocking. Until now it was a badge reading "coming soon".
--
-- The obvious way to build it is a dialogue after sign-in: ask for six digits,
-- and if they are right, let the person into the panel. That is worth very
-- little. The session cookie is already minted by then, and everything the
-- panel does goes through PostgREST with that cookie — so anyone who can send
-- an HTTP request with it skips the dialogue entirely and keeps every
-- permission the seat carries. A second factor enforced by a React component is
-- a second factor enforced by nobody.
--
-- So it is enforced here. Supabase puts the assurance level in the JWT as the
-- `aal` claim: `aal1` after a password or an OTP, `aal2` only after a TOTP
-- challenge has actually been answered. `is_platform_staff()` — which every
-- administrative policy and every SECURITY DEFINER entry point already consults
-- — now returns false for a staff member who has enrolled a factor and has not
-- used it. The panel then shows nothing, the RPCs refuse, and the API returns
-- empty sets, all for the same reason and without a separate code path.
--
-- Two deliberate limits.
--
-- Enrolment is not forced by this migration. Turning it on for accounts that
-- have not enrolled yet would lock every one of them out at once, including the
-- only administrator who could undo it. `require_staff_mfa` in `settings` is
-- the switch, defaulting off, and the checklist says to turn it on once every
-- staff account has a factor — which the admin console now shows.
--
-- Office members are not covered. An exchange clerk shares a counter terminal
-- and often one phone between them; requiring TOTP there buys little and would
-- be worked around by writing the seed on the wall. Platform staff hold the
-- powers worth protecting.
-- ─────────────────────────────────────────────────────────────────────────────

-- A. What the JWT says about how hard someone tried ───────────────────────────

/**
 * The caller's authenticator assurance level, straight from the token.
 *
 * `aal1` is a password or a one-time code. `aal2` means a second factor was
 * answered in this session. Absent on a service-role or anonymous call, which
 * is why the fallback matters: those paths are governed by their own rules and
 * must not be made *stricter* by accident.
 */
create or replace function public.current_aal()
returns text
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.aal', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'aal'),
    'aal1'
  );
$$;

/**
 * Has this account got a second factor it actually finished setting up?
 *
 * Only `verified` counts. An enrolment that was started and abandoned leaves an
 * `unverified` row behind, and treating that as protection would lock somebody
 * out of their own account over a QR code they never scanned.
 */
create or replace function public.has_verified_factor(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1 from auth.mfa_factors f
     where f.user_id = p_user and f.status = 'verified'
  );
$$;

/**
 * Is the second-factor requirement satisfied for this caller?
 *
 * True when they have no factor to use, or when they have one and used it. The
 * first half is what keeps this from being a lockout: enrolment is a separate
 * decision, made per account, and until it is made this function is transparent.
 */
create or replace function public.mfa_satisfied()
returns boolean
language sql
stable
-- SECURITY DEFINER is load-bearing, not incidental. This function reads
-- `public.settings`, whose SELECT policy is `is_platform_staff()` — which calls
-- straight back here. Run as the caller, that is unbounded recursion, and
-- because `is_platform_staff()` sits under every administrative policy in the
-- schema it would not fail in one place: it would fail in all of them at once.
-- The definer read bypasses the policy and cuts the cycle. What leaks is one
-- boolean setting and the caller's own factor count, which is what the caller
-- is asking about anyway.
security definer
set search_path = public, pg_temp
as $$
  select case
    when auth.uid() is null then true
    when not public.has_verified_factor() then
      -- No factor of their own. The platform-wide switch decides whether that
      -- is still acceptable for a staff seat.
      not coalesce((
        select (value #>> '{}')::boolean from public.settings where key = 'require_staff_mfa'
      ), false)
    else public.current_aal() = 'aal2'
  end;
$$;

-- B. Staff powers now depend on it ───────────────────────────────────────────

/**
 * Platform staff, but only with the second factor satisfied.
 *
 * Every administrative policy in this schema and every SECURITY DEFINER entry
 * point already routes through this one function, which is exactly why the
 * check belongs here rather than in twenty places that would drift.
 */
create or replace function public.is_platform_staff()
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select public.has_role(
           array['platform_support','platform_compliance','platform_admin','platform_superadmin']::public.app_role[])
     and public.mfa_satisfied();
$$;

/**
 * `has_role` gains the same gate — for platform roles, not platform scopes.
 *
 * Several functions ask `has_role(array['platform_admin',…])` directly rather
 * than going through `is_platform_staff()`, and leaving those unguarded would
 * make the whole thing decorative: `order_force_transition` and
 * `admin_create_office` are two of them.
 *
 * The gate keys off the *roles being asked about*, not off `scope_kind`. That
 * matters: `scope_kind` defaults to NULL and almost every platform call omits
 * it, so a condition written against the scope would have skipped precisely the
 * calls it needed to catch. The role names cannot be omitted.
 *
 * Office scopes are untouched, deliberately: see the header. The parameter
 * names are `scope_kind` and `scope` because that is what they already were —
 * Postgres refuses to rename an input parameter on replace, and every existing
 * caller that names its arguments would break if it did not.
 */
create or replace function public.has_role(
  roles public.app_role[],
  scope_kind text default null,
  scope uuid default null
) returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid()
      and m.deleted_at is null
      and m.role = any (roles)
      and (scope_kind is null or m.scope_type = scope_kind)
      and (scope is null or m.scope_id = scope)
  )
  and (
    -- Only a question about platform power needs the second factor.
    not exists (select 1 from unnest(roles) r where r::text like 'platform\_%')
    or public.mfa_satisfied()
  );
$$;

-- C. The switch, off ─────────────────────────────────────────────────────────

-- `settings` is (key, value, …) with no description column; the reasoning lives
-- in this migration and on the launch checklist instead.
insert into public.settings (key, value)
values ('require_staff_mfa', 'false'::jsonb)
on conflict (key) do nothing;

-- D. Who has enrolled ────────────────────────────────────────────────────────

/**
 * Second-factor coverage across staff, for the console.
 *
 * Reads `auth.mfa_factors`, which no client role may select from, so it is
 * SECURITY DEFINER and returns only the two facts the screen needs — never a
 * secret, never a factor id.
 */
create or replace function public.staff_mfa_coverage()
returns table (user_id uuid, full_name text, roles text[], enrolled boolean)
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
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
$$;

revoke all on function public.current_aal() from public;
revoke all on function public.has_verified_factor(uuid) from public;
revoke all on function public.mfa_satisfied() from public;
revoke all on function public.staff_mfa_coverage() from public;
grant execute on function public.current_aal() to anon, authenticated;
grant execute on function public.has_verified_factor(uuid) to authenticated;
grant execute on function public.mfa_satisfied() to anon, authenticated;
grant execute on function public.staff_mfa_coverage() to authenticated;
grant execute on function public.has_role(public.app_role[], text, uuid) to anon, authenticated;
grant execute on function public.is_platform_staff() to anon, authenticated;
