-- ─────────────────────────────────────────────────────────────────────────────
-- 0026 — Provisioning an office a login, without a service-role key
--
-- The brief: an administrator creates an office, types a destination phone,
-- and the office receives its credentials by SMS. The office user then picks
-- their own password on first entry, or declines and keeps the generated one.
--
-- The constraint: ADR 0010. This application holds no service-role key, so
-- `auth.admin.createUser` does not exist for us. The obvious substitute —
-- ordinary `signUp` on the publishable key — was tried and is a dead end on a
-- hosted project: it demands a confirmable email address, sends a confirmation
-- through Supabase's shared SMTP, and that is rate-limited to a couple an hour.
-- An administrator provisioning five offices in an afternoon would hit it on
-- the third.
--
-- What *does* work, and is already wired end to end in this app, is phone OTP.
-- `signInWithOtp({ phone })` creates the account if it does not exist. The
-- destination phone the administrator types is exactly the identifier the
-- office will use. So:
--
--   1. the administrator creates an invitation — username, generated password,
--      destination phone — and it is texted to that phone;
--   2. the office signs in by phone, the way every other user does;
--   3. on arrival the panel claims the invitation: the seat is granted and the
--      generated password is applied to their own account by their own session,
--      so the credentials in the SMS work from then on;
--   4. they are offered, once, to choose a different password. Declining is
--      allowed and is not nagged about again.
--
-- The generated password sits in this table between (1) and (3). That is the
-- uncomfortable part and it is bounded deliberately: no role may SELECT the
-- table at all, the only reader is the claim function, the value is erased the
-- moment it is used, and an unclaimed invitation expires. It is a bootstrap
-- credential with a short life, not a stored password.
-- ─────────────────────────────────────────────────────────────────────────────

-- A. A name to sign in with ──────────────────────────────────────────────────
-- An exchange clerk should not need an email address to open the panel. The
-- account's real identifier stays the phone number — that is what Supabase
-- authenticates — and the username is the thing a human types, resolved to a
-- phone or email by `office_login_identity` below.

alter table public.profiles
  add column if not exists username text;

create unique index if not exists profiles_username_unique
  on public.profiles (lower(username))
  where username is not null and deleted_at is null;

comment on column public.profiles.username is
  'What an office types at sign-in. The account is still keyed by phone; this resolves to it.';

-- B. The invitation ──────────────────────────────────────────────────────────

create table if not exists public.office_invitations (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.exchange_offices (id),
  username text not null,
  /** E.164, and the identifier the office will actually authenticate with. */
  phone text not null,
  role public.app_role not null default 'office_owner',
  /**
   * The generated password, until it is claimed.
   *
   * No policy grants SELECT on this table, so nothing reaches this column
   * except `office_invitation_claim`, which runs as the definer, returns it
   * once, and nulls it in the same statement.
   */
  secret text,
  created_by uuid not null references public.profiles (id),
  expires_at timestamptz not null default now() + interval '7 days',
  claimed_at timestamptz,
  claimed_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists office_invitations_open
  on public.office_invitations (phone)
  where claimed_at is null;

alter table public.office_invitations enable row level security;
-- Deliberately no policy: every read and write goes through the functions
-- below. A table whose whole purpose is to hold a secret for ten minutes
-- should not be selectable by the role that is about to be given the secret.

/**
 * Create the invitation an SMS will carry.
 *
 * The password arrives from the application rather than being generated here:
 * it is read aloud down a phone line more often than it is copied, so its
 * alphabet drops the characters that get misheard (0/O, 1/l/I, 5/S), and that
 * is a decision about people, which belongs in the app.
 */
create or replace function public.office_invitation_create(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_office uuid := (p_payload->>'office_id')::uuid;
  v_username text := lower(btrim(coalesce(p_payload->>'username', '')));
  v_phone text := btrim(coalesce(p_payload->>'phone', ''));
  v_secret text := coalesce(p_payload->>'secret', '');
  v_role public.app_role := coalesce(nullif(p_payload->>'role', ''), 'office_owner')::public.app_role;
  v_id uuid;
begin
  if not public.has_role(array['platform_admin','platform_superadmin']::public.app_role[]) then
    raise exception 'only a platform administrator may provision an office login';
  end if;
  if v_username !~ '^[a-z0-9][a-z0-9._-]{2,38}[a-z0-9]$' then
    raise exception 'a username is 4-40 characters of lowercase letters, digits, dot, dash or underscore';
  end if;
  if v_phone !~ '^\+[0-9]{10,15}$' then
    raise exception 'the destination phone must be in international format';
  end if;
  if length(v_secret) < 10 then
    raise exception 'the generated password is too short';
  end if;
  if v_role::text not like 'office\_%' then
    raise exception '% is not an office role', v_role;
  end if;
  if not exists (select 1 from public.exchange_offices where id = v_office and deleted_at is null) then
    raise exception 'exchange office not found';
  end if;
  if exists (select 1 from public.profiles
              where lower(username) = v_username and deleted_at is null) then
    raise exception 'username:that username is taken';
  end if;

  -- One open invitation per phone. A second one supersedes the first rather
  -- than racing it, so an administrator who re-sends does not create a state
  -- where two different passwords are both "the" password.
  update public.office_invitations
     set expires_at = now()
   where phone = v_phone and claimed_at is null and expires_at > now();

  insert into public.office_invitations (office_id, username, phone, role, secret, created_by)
  values (v_office, v_username, v_phone, v_role, v_secret, auth.uid())
  returning id into v_id;

  perform public.audit_event(
    'office.invite', 'exchange_offices', v_office, null,
    jsonb_build_object('username', v_username, 'role', v_role),
    p_payload->>'reason');

  return v_id;
end;
$$;

/**
 * Is there an invitation waiting for whoever just signed in?
 *
 * Answers from the caller's own verified phone, never from a parameter — an
 * invitation you can look up by typing someone else's number is an invitation
 * anyone can claim. Returns no secret; claiming is a separate, deliberate act.
 */
create or replace function public.office_invitation_pending()
returns table (id uuid, office_id uuid, office_name text, username text, role public.app_role)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_phone text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select u.phone into v_phone from auth.users u
   where u.id = auth.uid() and u.phone_confirmed_at is not null;
  if v_phone is null then return; end if;

  return query
  select i.id, i.office_id,
         coalesce(o.display_name, o.legal_name_fa),
         i.username, i.role
    from public.office_invitations i
    join public.exchange_offices o on o.id = i.office_id
   where regexp_replace(i.phone, '\D', '', 'g') = regexp_replace(v_phone, '\D', '', 'g')
     and i.claimed_at is null
     and i.expires_at > now()
   order by i.created_at desc
   limit 1;
end;
$$;

/**
 * Take up the invitation: the seat, the username, and the password once.
 *
 * The secret comes back exactly once and is erased in the same statement, so a
 * replayed call returns nothing. The caller then applies it to their own
 * account through `updateUser`, which is the only way a password can be set
 * without a service-role key — and is the correct way regardless, since it is
 * their account.
 */
create or replace function public.office_invitation_claim(p_invitation uuid)
returns table (office_id uuid, username text, secret text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_phone text;
  v_row public.office_invitations;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select u.phone into v_phone from auth.users u
   where u.id = auth.uid() and u.phone_confirmed_at is not null;
  if v_phone is null then raise exception 'this account has no verified phone'; end if;

  select * into v_row from public.office_invitations
   where id = p_invitation and claimed_at is null and expires_at > now()
   for update;
  if v_row.id is null then raise exception 'that invitation is not open'; end if;
  if regexp_replace(v_row.phone, '\D', '', 'g') <> regexp_replace(v_phone, '\D', '', 'g') then
    raise exception 'that invitation was not issued to this number';
  end if;

  insert into public.memberships (user_id, role, scope_type, scope_id, created_by)
  values (auth.uid(), v_row.role, 'office', v_row.office_id, v_row.created_by)
  on conflict (user_id, role, scope_type, scope_id)
    do update set deleted_at = null, updated_at = now();

  update public.profiles
     set username = v_row.username,
         -- Still on a password they did not choose, until they say otherwise.
         password_set_by_user = false
   where id = auth.uid();

  update public.office_invitations
     set claimed_at = now(), claimed_by = auth.uid(), secret = null
   where id = v_row.id;

  perform public.audit_event(
    'office.invite.claim', 'exchange_offices', v_row.office_id, null,
    jsonb_build_object('username', v_row.username, 'role', v_row.role), null);

  return query select v_row.office_id, v_row.username, v_row.secret;
end;
$$;

-- C. Signing in by username ──────────────────────────────────────────────────

/**
 * Resolve a username to the identifier Supabase authenticates, but only for
 * somebody who already has the password.
 *
 * The password is checked here, against `auth.users.encrypted_password`, before
 * anything is returned. That ordering is the entire point: a function that
 * resolved a username to a phone number *first* would be a way to harvest the
 * phone number of every office on the platform with nothing but a word list.
 * This one tells a correct guesser something they already knew and everyone
 * else nothing at all.
 *
 * Both identifiers come back because which one works depends on the project's
 * auth settings, not on the account: an office provisioned through phone OTP
 * has a phone and no email, a staff account seeded with an address has both,
 * and the phone grant is only available once the phone provider is switched on
 * with real gateway credentials. The sign-in route uses whichever it is given.
 *
 * It does not sign anybody in. The caller still goes through Supabase's own
 * password grant, which is what issues the session, applies its own rate
 * limiting, and remains the single place a session can be minted.
 */
create or replace function public.office_login_identity(p_username text, p_password text)
returns table (email text, phone text)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_user uuid;
  v_email text;
  v_phone text;
  v_hash text;
begin
  select p.id into v_user
    from public.profiles p
   where lower(p.username) = lower(btrim(coalesce(p_username, '')))
     and p.deleted_at is null;
  if v_user is null then return; end if;

  select u.email, u.phone, u.encrypted_password
    into v_email, v_phone, v_hash
    from auth.users u where u.id = v_user;
  if v_hash is null then return; end if;
  if crypt(coalesce(p_password, ''), v_hash) <> v_hash then return; end if;

  return query select v_email, v_phone;
end;
$$;

drop function if exists public.office_login_phone(text, text);

-- D. Grants ──────────────────────────────────────────────────────────────────

revoke all on function public.office_invitation_create(jsonb) from public;
revoke all on function public.office_invitation_pending() from public;
revoke all on function public.office_invitation_claim(uuid) from public;
revoke all on function public.office_login_identity(text, text) from public;
grant execute on function public.office_invitation_create(jsonb) to authenticated;
grant execute on function public.office_invitation_pending() to authenticated;
grant execute on function public.office_invitation_claim(uuid) to authenticated;
-- Reached before there is a session, from the sign-in route.
grant execute on function public.office_login_identity(text, text) to anon, authenticated;
