-- 0014 — Phase 4: the platform's administration surface (§4.3, §16)
--
-- Four capabilities the super-admin panel is required to have, and one rule
-- that governs all of them: an administrator's power is *wider*, never
-- *quieter*. Everything below either writes an audit row itself or fires a
-- trigger that does, and the two operations that can move money — forcing a
-- transition and refunding — take a written reason as an argument, not as an
-- afterthought.
--
--   §16.1/2  provision an office and override any of its defaults
--   §16.3    act on an office's behalf, time-boxed and flagged
--   §16.4    force any order transition, correcting the ledger by compensating
--            entries rather than by mutation
--   §16.5    raise an order on a customer's behalf, on the identical path
--
-- Grants follow ADR 0015: every function starts with EXECUTE revoked from
-- PUBLIC and is granted back only where a real caller needs it.

-- ─────────────────────────────────────────────────────────────────────────────
-- A. Nothing is deleted (§0.7)
--
-- `offices_admin_write` and `office_accounts_manage` are FOR ALL policies, so
-- until now an administrator could have issued a DELETE and taken an office's
-- history with it. Soft-delete columns exist on all of these tables; this makes
-- them the only option.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.forbid_delete()
returns trigger language plpgsql as $$
begin
  raise exception 'public.% is soft-delete only: set deleted_at instead', tg_table_name;
end $$;

create trigger t_exchange_offices_no_delete before delete on public.exchange_offices
  for each row execute function public.forbid_delete();
create trigger t_office_accounts_no_delete before delete on public.office_accounts
  for each row execute function public.forbid_delete();
create trigger t_office_rate_config_no_delete before delete on public.office_rate_config
  for each row execute function public.forbid_delete();
create trigger t_memberships_no_delete before delete on public.memberships
  for each row execute function public.forbid_delete();
create trigger t_cms_content_no_delete before delete on public.cms_content
  for each row execute function public.forbid_delete();
create trigger t_feature_flags_no_delete before delete on public.feature_flags
  for each row execute function public.forbid_delete();
create trigger t_orders_no_delete before delete on public.orders
  for each row execute function public.forbid_delete();

-- ─────────────────────────────────────────────────────────────────────────────
-- B. The audit trail (§0.7, §16.8)
--
-- audit_log has RLS on and no INSERT policy, so nothing writes it directly.
-- These SECURITY DEFINER functions are the only door, which is what makes the
-- trail trustworthy: you cannot change a config row *without* leaving one.
--
-- `asaex.reason` is a transaction-local setting the admin entry points below
-- set before they touch anything, so the row-level audit carries the operator's
-- stated reason rather than an anonymous diff.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.actor_role_label()
returns text language sql stable security definer set search_path = public as $$
  select m.role::text
    from public.memberships m
   where m.user_id = auth.uid() and m.deleted_at is null
   order by array_position(
     array['platform_superadmin','platform_admin','platform_compliance','platform_support',
           'office_owner','office_finance','office_operator','office_viewer',
           'customer']::public.app_role[],
     m.role)
   limit 1;
$$;

create or replace function public.audit_event(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_before jsonb default null,
  p_after jsonb default null,
  p_reason text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into public.audit_log (
    actor_id, actor_role, action, entity_type, entity_id, before, after, reason
  ) values (
    auth.uid(), public.actor_role_label(), p_action, p_entity_type, p_entity_id,
    p_before, p_after, nullif(btrim(coalesce(p_reason, '')), '')
  ) returning id into v_id;
  return v_id;
end $$;

create or replace function public.audit_row()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_id uuid;
begin
  if tg_op = 'INSERT' then
    v_after := to_jsonb(new);
  elsif tg_op = 'UPDATE' then
    v_before := to_jsonb(old);
    v_after := to_jsonb(new);
    -- updated_at moves on every write; a diff of nothing is not an event.
    if (v_before - 'updated_at') = (v_after - 'updated_at') then
      return new;
    end if;
  else
    v_before := to_jsonb(old);
  end if;

  begin
    v_id := (coalesce(v_after, v_before) ->> 'id')::uuid;
  exception when others then
    v_id := null;   -- settings is keyed by text; the payload carries the key
  end;

  perform public.audit_event(
    tg_table_name || '.' || lower(tg_op), tg_table_name, v_id, v_before, v_after,
    nullif(current_setting('asaex.reason', true), '')
  );
  return coalesce(new, old);
end $$;

create trigger t_exchange_offices_audit after insert or update or delete on public.exchange_offices
  for each row execute function public.audit_row();
create trigger t_office_accounts_audit after insert or update or delete on public.office_accounts
  for each row execute function public.audit_row();
create trigger t_office_rate_config_audit after insert or update or delete on public.office_rate_config
  for each row execute function public.audit_row();
create trigger t_memberships_audit after insert or update or delete on public.memberships
  for each row execute function public.audit_row();
create trigger t_feature_flags_audit after insert or update or delete on public.feature_flags
  for each row execute function public.audit_row();
create trigger t_settings_audit after insert or update or delete on public.settings
  for each row execute function public.audit_row();
create trigger t_cms_content_audit after insert or update or delete on public.cms_content
  for each row execute function public.audit_row();
create trigger t_business_calendar_audit after insert or update or delete on public.business_calendar
  for each row execute function public.audit_row();

-- ─────────────────────────────────────────────────────────────────────────────
-- C. Impersonation (§16.3)
--
-- "Banner-flagged, time-boxed, reason-required, fully audited." The row *is*
-- the session: it carries the reason, it expires on its own, and every office
-- screen becomes reachable because `is_office_member` consults it — so there is
-- no second, weaker code path for an impersonating admin to walk down. Actions
-- taken while impersonating still record the administrator's own user id in
-- order_events and audit_log; the office is the scope, never the identity.
-- ─────────────────────────────────────────────────────────────────────────────

create table public.impersonations (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles (id),
  office_id uuid not null references public.exchange_offices (id),
  reason text not null check (length(btrim(reason)) >= 8),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > started_at),
  check (expires_at <= started_at + interval '4 hours')
);
create index impersonations_active on public.impersonations (actor_id, office_id, expires_at)
  where ended_at is null;

alter table public.impersonations enable row level security;

-- The administrator sees their own sessions; platform admins see all of them;
-- and an office owner can see who walked through their panel and why.
create policy impersonations_visibility on public.impersonations
  for select using (
    actor_id = auth.uid()
    or public.has_role(array['platform_admin','platform_superadmin']::public.app_role[])
    or public.has_role(array['office_owner']::public.app_role[], 'office', office_id)
  );

create trigger t_impersonations_no_delete before delete on public.impersonations
  for each row execute function public.forbid_delete();

/**
 * Is the caller currently standing in for this office? SECURITY DEFINER so it
 * can read the table from inside an RLS policy without the policy on
 * `impersonations` having to be consulted (and without recursing through it).
 */
create or replace function public.impersonating(p_office uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.impersonations i
    where i.actor_id = auth.uid()
      and i.office_id = p_office
      and i.ended_at is null
      and i.expires_at > now()
  );
$$;

/** The caller's live session, for the banner. Null when not impersonating. */
create or replace function public.active_impersonation()
returns public.impersonations language sql stable security definer set search_path = public as $$
  select i.* from public.impersonations i
   where i.actor_id = auth.uid() and i.ended_at is null and i.expires_at > now()
   order by i.started_at desc
   limit 1;
$$;

-- Office membership now has two sources: a real membership row, or a live
-- impersonation. Every policy that already said `is_office_member` picks this
-- up unchanged, which is the point.
create or replace function public.is_office_member(office uuid)
returns boolean language sql stable as $$
  select public.has_role(
           array['office_viewer','office_operator','office_finance','office_owner']::public.app_role[],
           'office', office)
      or public.impersonating(office);
$$;

create or replace function public.impersonation_start(
  p_office uuid,
  p_reason text,
  p_minutes int default 30
) returns public.impersonations language plpgsql security definer set search_path = public as $$
declare
  v_row public.impersonations;
  v_minutes int := least(greatest(coalesce(p_minutes, 30), 5), 240);
begin
  -- §5 hands impersonation to the superadmin by name. Widening it later is a
  -- one-line change; narrowing it after the fact never is.
  if not public.has_role(array['platform_superadmin']::public.app_role[]) then
    raise exception 'only a platform superadmin may impersonate an exchange office';
  end if;
  if coalesce(length(btrim(p_reason)), 0) < 8 then
    raise exception 'impersonation requires a written reason';
  end if;
  if not exists (select 1 from public.exchange_offices where id = p_office and deleted_at is null) then
    raise exception 'exchange office not found';
  end if;

  -- One office at a time: two live sessions would make the banner a lie.
  update public.impersonations
     set ended_at = now()
   where actor_id = auth.uid() and ended_at is null and expires_at > now();

  insert into public.impersonations (actor_id, office_id, reason, expires_at)
  values (auth.uid(), p_office, btrim(p_reason), now() + make_interval(mins => v_minutes))
  returning * into v_row;

  perform public.audit_event(
    'impersonation.start', 'exchange_offices', p_office, null, to_jsonb(v_row), p_reason
  );
  return v_row;
end $$;

create or replace function public.impersonation_end()
returns void language plpgsql security definer set search_path = public as $$
declare v_row public.impersonations;
begin
  update public.impersonations
     set ended_at = now()
   where actor_id = auth.uid() and ended_at is null and expires_at > now()
  returning * into v_row;

  if v_row.id is not null then
    perform public.audit_event(
      'impersonation.end', 'exchange_offices', v_row.office_id, null, to_jsonb(v_row), v_row.reason
    );
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- D. Provisioning an office (§16.1, §16.2)
--
-- The wizard is one transaction, not seven screens each half-saving. It starts
-- from a platform-wide template held in `settings.office_defaults` so that
-- §16.2's "diffs against the default template are visible at a glance" has
-- something concrete to diff against, and it lands the office in `draft` —
-- activation is a separate, deliberate act.
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.settings (key, value) values (
  'office_defaults',
  jsonb_build_object(
    'working_hours', jsonb_build_object(
      'tz', 'Asia/Tehran',
      'week', jsonb_build_object(
        'sat', '09:00-17:00', 'sun', '09:00-17:00', 'mon', '09:00-17:00',
        'tue', '09:00-17:00', 'wed', '09:00-17:00', 'thu', '09:00-13:00',
        'fri', null)),
    'rate_config', jsonb_build_array(
      jsonb_build_object('corridor', 'USD-IRT', 'spread_bps', 90),
      jsonb_build_object('corridor', 'EUR-IRT', 'spread_bps', 90),
      jsonb_build_object('corridor', 'AED-IRT', 'spread_bps', 110),
      jsonb_build_object('corridor', 'TRY-IRT', 'spread_bps', 120)),
    'sla_overrides', jsonb_build_object('target_hours', 24, 'max_hours', 72),
    'auto_accept_rules', jsonb_build_object('enabled', false, 'max_amount_minor', null),
    'branding', jsonb_build_object('accent', '#0F9D8C')
  )
) on conflict (key) do nothing;

create or replace function public.office_defaults()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select value from public.settings where key = 'office_defaults'), '{}'::jsonb);
$$;

/**
 * Provision an office from the wizard payload. Shape:
 *   { slug, legal_name_fa, legal_name_en, license_no, city, country,
 *     contact:{}, branding:{}, working_hours:{}, corridors:[..],
 *     accounts:[{currency,kind,label,details,is_public}],
 *     rate_config:[{corridor,spread_bps,min_amount_minor,max_amount_minor,cutoff_time}],
 *     reason }
 * Anything omitted falls back to the platform template.
 */
create or replace function public.admin_create_office(p_office jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_defaults jsonb := public.office_defaults();
  v_slug text := lower(btrim(coalesce(p_office->>'slug', '')));
  v_row jsonb;
  v_rates jsonb;
begin
  if not public.has_role(array['platform_admin','platform_superadmin']::public.app_role[]) then
    raise exception 'only a platform administrator may provision an exchange office';
  end if;
  if v_slug !~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$' then
    raise exception 'slug must be 3-40 lowercase letters, digits or hyphens';
  end if;
  if coalesce(btrim(p_office->>'legal_name_fa'), '') = ''
     or coalesce(btrim(p_office->>'legal_name_en'), '') = '' then
    raise exception 'both legal names are required';
  end if;
  if coalesce(btrim(p_office->>'license_no'), '') = '' then
    raise exception 'a licence number is required';
  end if;

  perform set_config('asaex.reason', coalesce(p_office->>'reason', 'office provisioned'), true);

  insert into public.exchange_offices (
    slug, legal_name_fa, legal_name_en, license_no, country, city, status,
    branding, contact, working_hours, corridors, auto_accept_rules, sla_overrides,
    created_by_admin
  ) values (
    v_slug,
    btrim(p_office->>'legal_name_fa'),
    btrim(p_office->>'legal_name_en'),
    btrim(p_office->>'license_no'),
    upper(coalesce(nullif(btrim(p_office->>'country'), ''), 'IR')),
    nullif(btrim(coalesce(p_office->>'city', '')), ''),
    'draft',
    coalesce(p_office->'branding', v_defaults->'branding', '{}'::jsonb),
    coalesce(p_office->'contact', '{}'::jsonb),
    coalesce(p_office->'working_hours', v_defaults->'working_hours', '{}'::jsonb),
    coalesce(p_office->'corridors', '[]'::jsonb),
    coalesce(p_office->'auto_accept_rules', v_defaults->'auto_accept_rules', '{}'::jsonb),
    coalesce(p_office->'sla_overrides', v_defaults->'sla_overrides', '{}'::jsonb),
    auth.uid()
  ) returning id into v_id;

  for v_row in select * from jsonb_array_elements(coalesce(p_office->'accounts', '[]'::jsonb)) loop
    insert into public.office_accounts (office_id, currency, kind, details, is_public, label)
    values (
      v_id,
      upper(btrim(v_row->>'currency')),
      coalesce(nullif(btrim(coalesce(v_row->>'kind', '')), ''), 'iban'),
      coalesce(v_row->'details', '{}'::jsonb),
      coalesce((v_row->>'is_public')::boolean, true),
      nullif(btrim(coalesce(v_row->>'label', '')), '')
    );
  end loop;

  v_rates := coalesce(p_office->'rate_config', v_defaults->'rate_config', '[]'::jsonb);
  for v_row in select * from jsonb_array_elements(v_rates) loop
    insert into public.office_rate_config (
      office_id, corridor, spread_bps, min_amount_minor, max_amount_minor, cutoff_time
    ) values (
      v_id,
      upper(btrim(v_row->>'corridor')),
      coalesce((v_row->>'spread_bps')::int, 0),
      nullif(btrim(coalesce(v_row->>'min_amount_minor', '')), '')::bigint,
      nullif(btrim(coalesce(v_row->>'max_amount_minor', '')), '')::bigint,
      nullif(btrim(coalesce(v_row->>'cutoff_time', '')), '')::time
    ) on conflict (office_id, corridor) do nothing;
  end loop;

  -- A settlement balance per currency the office will actually touch, so
  -- /office/liquidity has rows from day one rather than after the first order.
  insert into public.office_balances (office_id, currency)
  select v_id, c from (
    select distinct upper(split_part(corridor, '-', 1)) as c
      from public.office_rate_config where office_id = v_id
    union
    select distinct upper(split_part(corridor, '-', 2))
      from public.office_rate_config where office_id = v_id
  ) t where c <> ''
  on conflict (office_id, currency) do nothing;

  perform public.audit_event(
    'office.provision', 'exchange_offices', v_id, null,
    to_jsonb((select e from public.exchange_offices e where e.id = v_id)),
    p_office->>'reason'
  );
  return v_id;
end $$;

/** Move an office through draft → active → suspended → archived. */
create or replace function public.admin_set_office_status(
  p_office uuid, p_status text, p_reason text default null
) returns text language plpgsql security definer set search_path = public as $$
declare v_before text;
begin
  if not public.has_role(array['platform_admin','platform_superadmin']::public.app_role[]) then
    raise exception 'only a platform administrator may change an office''s status';
  end if;
  if p_status not in ('draft','active','suspended','archived') then
    raise exception 'unknown office status %', p_status;
  end if;

  select status into v_before from public.exchange_offices where id = p_office and deleted_at is null;
  if v_before is null then raise exception 'exchange office not found'; end if;
  if v_before = p_status then raise exception 'the office is already %', p_status; end if;

  -- Turning an office off takes customers' live orders with it, so it is never
  -- a silent click.
  if p_status in ('suspended','archived') and coalesce(length(btrim(coalesce(p_reason, ''))), 0) < 8 then
    raise exception 'suspending or archiving an office requires a written reason';
  end if;
  if p_status = 'active' and not exists (
    select 1 from public.office_accounts
     where office_id = p_office and is_public and active and deleted_at is null
  ) then
    raise exception 'an office cannot go live without a public settlement account';
  end if;

  perform set_config('asaex.reason', coalesce(p_reason, 'status changed'), true);
  update public.exchange_offices
     set status = p_status,
         deleted_at = case when p_status = 'archived' then now() else deleted_at end
   where id = p_office;

  perform public.audit_event(
    'office.status', 'exchange_offices', p_office,
    jsonb_build_object('status', v_before), jsonb_build_object('status', p_status), p_reason
  );
  return p_status;
end $$;

/** Grant or revoke an office seat. Revoking is a soft delete, like everything. */
create or replace function public.admin_set_office_member(
  p_office uuid, p_user uuid, p_role public.app_role, p_grant boolean default true
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.has_role(array['platform_admin','platform_superadmin']::public.app_role[])
          or public.has_role(array['office_owner']::public.app_role[], 'office', p_office)) then
    raise exception 'only a platform administrator or the office owner may change the team';
  end if;
  if p_role::text not like 'office\_%' then
    raise exception '% is not an office role', p_role;
  end if;
  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'no such user';
  end if;

  if p_grant then
    insert into public.memberships (user_id, role, scope_type, scope_id, created_by)
    values (p_user, p_role, 'office', p_office, auth.uid())
    on conflict (user_id, role, scope_type, scope_id)
      do update set deleted_at = null, updated_at = now();
  else
    update public.memberships
       set deleted_at = now()
     where user_id = p_user and role = p_role and scope_type = 'office'
       and scope_id = p_office and deleted_at is null;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- E. Forcing a transition, and putting money back (§16.4)
--
-- assert_transition gains a `p_force` flag. It is the *only* thing force skips:
-- the state precondition, the optimistic-version check, the orders update and
-- the append-only event row all still happen, so a forced move is a first-class
-- citizen of the timeline rather than a hole in it. The 7-argument call sites
-- from 0009/0012 keep working unchanged because the flag defaults to false.
--
-- Dropping and recreating is deliberate: an overload would have left two copies
-- of the state machine to keep in step, which is exactly the bug this function
-- exists to prevent.
-- ─────────────────────────────────────────────────────────────────────────────

drop function if exists public.assert_transition(
  uuid, public.order_state, public.order_state, uuid, text, text, int);

create or replace function public.assert_transition(
  p_order uuid,
  p_from public.order_state,
  p_to public.order_state,
  p_actor uuid,
  p_actor_role text,
  p_reason text default null,
  p_expected_version int default null,
  p_force boolean default false
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_state public.order_state;
  v_version int;
begin
  select state, version into v_state, v_version from public.orders where id = p_order for update;
  if v_state is null then
    raise exception 'order % not found', p_order;
  end if;
  if v_state <> p_from then
    raise exception 'order % is in state %, expected %', p_order, v_state, p_from;
  end if;
  if p_expected_version is not null and v_version <> p_expected_version then
    raise exception 'order % version mismatch (have %, expected %)', p_order, v_version, p_expected_version;
  end if;
  if not p_force and not (p_to = any (public.allowed_transitions(p_from))) then
    raise exception 'transition % → % is not allowed', p_from, p_to;
  end if;

  update public.orders
    set state = p_to, state_since = now(), version = version + 1
    where id = p_order;

  insert into public.order_events (order_id, from_state, to_state, actor_id, actor_role, reason, meta)
    values (p_order, p_from, p_to, p_actor, p_actor_role, p_reason,
            case when p_force then jsonb_build_object('forced', true) else '{}'::jsonb end);
end $$;

revoke all on function public.assert_transition(
  uuid, public.order_state, public.order_state, uuid, text, text, int, boolean)
  from public, anon, authenticated;

/**
 * Give the Toman leg back. §16.4 is explicit that the ledger is corrected "by
 * compensating entries rather than mutation", so this reverses the *actual*
 * rows posted for the order rather than recomputing what they should have been
 * — a reversal of a balanced set is balanced by construction, and it survives
 * a later change to the fee split that a recomputation would silently rewrite.
 */
create or replace function public.post_order_refund(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_txn uuid := gen_random_uuid();
  v_posted int;
begin
  if exists (select 1 from public.ledger_entries
              where order_id = p_order and memo like 'reversal:%') then
    raise exception 'order % has already been reversed', p_order;
  end if;

  insert into public.ledger_entries (
    txn_id, ledger_account_id, direction, amount_minor, currency, order_id, memo
  )
  select v_txn, le.ledger_account_id,
         case le.direction when 'debit' then 'credit' else 'debit' end::public.ledger_direction,
         le.amount_minor, le.currency, le.order_id,
         'reversal: ' || coalesce(le.memo, 'entry')
    from public.ledger_entries le
   where le.order_id = p_order;

  get diagnostics v_posted = row_count;
  if v_posted = 0 then
    -- Refunding before funding is not an error; there is simply nothing held.
    return;
  end if;
end $$;

/**
 * The administrator's override. Wider than any role's matrix, and noisier than
 * any of them: a reason is an argument, the event row is flagged `forced`, and
 * an audit row lands beside it.
 *
 * Two things force does not do. It will not depart a terminal state — a
 * completed order is corrected by a new compensating action, not by being
 * rewound — and it will not post the same money twice.
 */
create or replace function public.order_force_transition(
  p_order uuid,
  p_to public.order_state,
  p_reason text
) returns public.order_state language plpgsql security definer set search_path = public as $$
declare
  o public.orders%rowtype;
  v_terminal public.order_state[] :=
    array['completed','cancelled','refunded','expired','sla_breached']::public.order_state[];
begin
  if not public.has_role(array['platform_admin','platform_superadmin']::public.app_role[]) then
    raise exception 'only a platform administrator may force a transition';
  end if;
  if coalesce(length(btrim(coalesce(p_reason, ''))), 0) < 8 then
    raise exception 'forcing a transition requires a written reason';
  end if;

  select * into o from public.orders where id = p_order;
  if o.id is null then raise exception 'order not found'; end if;
  if o.state = any (v_terminal) then
    raise exception 'order % is already %; post a compensating action instead',
      o.public_ref, o.state;
  end if;
  if p_to = o.state then
    raise exception 'order % is already in %', o.public_ref, p_to;
  end if;

  perform set_config('asaex.reason', p_reason, true);
  perform public.assert_transition(
    p_order, o.state, p_to, auth.uid(), 'platform_force', p_reason, o.version, true);

  if p_to = 'refunded' then
    perform public.post_order_refund(p_order);
  elsif p_to = 'irt_funded' then
    perform public.post_order_funding(p_order);
  elsif p_to = 'irt_released' then
    perform public.post_order_release(p_order);
  end if;

  perform public.audit_event(
    'order.force_transition', 'orders', p_order,
    jsonb_build_object('state', o.state), jsonb_build_object('state', p_to), p_reason
  );
  return p_to;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- F. An order raised on a customer's behalf (§16.5)
--
-- "Follows the identical path and state machine as any customer order." So this
-- writes a draft and stops. From there `order_advance` is the only way forward,
-- for the admin and the customer alike; the only difference the row carries is
-- `origin = 'admin_on_behalf'`, which the customer's own timeline shows.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.admin_create_order_on_behalf(p_payload jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_customer uuid := (p_payload->>'customer_id')::uuid;
  v_dest uuid := nullif(p_payload->>'destination_account_id', '')::uuid;
begin
  if not public.has_role(array['platform_admin','platform_superadmin']::public.app_role[]) then
    raise exception 'only a platform administrator may raise an order on behalf of a customer';
  end if;
  if v_customer is null or not exists (select 1 from public.profiles where id = v_customer) then
    raise exception 'no such customer';
  end if;
  if v_dest is not null and not exists (
    select 1 from public.beneficiary_accounts
     where id = v_dest and user_id = v_customer and deleted_at is null
  ) then
    raise exception 'that destination account does not belong to the customer';
  end if;

  perform set_config('asaex.reason',
    coalesce(p_payload->>'reason', 'raised from a customer proposal'), true);

  insert into public.orders (
    customer_id, corridor, send_currency, send_amount_minor,
    receive_currency, receive_amount_minor, locked_rate, rate_locked_at, rate_expires_at,
    platform_fee_minor, office_fee_minor, spread_breakdown,
    destination_account_id, purpose_of_transfer, notes, origin, state
  ) values (
    v_customer,
    upper(btrim(p_payload->>'corridor')),
    upper(btrim(p_payload->>'send_currency')),
    (p_payload->>'send_amount_minor')::bigint,
    upper(btrim(p_payload->>'receive_currency')),
    (p_payload->>'receive_amount_minor')::bigint,
    (p_payload->>'locked_rate')::numeric,
    now(),
    now() + make_interval(mins => coalesce((p_payload->>'lock_minutes')::int, 15)),
    coalesce((p_payload->>'platform_fee_minor')::bigint, 0),
    coalesce((p_payload->>'office_fee_minor')::bigint, 0),
    coalesce(p_payload->'spread_breakdown', '[]'::jsonb),
    v_dest,
    nullif(btrim(coalesce(p_payload->>'purpose_of_transfer', '')), ''),
    nullif(btrim(coalesce(p_payload->>'notes', '')), ''),
    'admin_on_behalf',
    'draft'
  ) returning id into v_id;

  perform public.audit_event(
    'order.on_behalf', 'orders', v_id, null,
    jsonb_build_object('customer_id', v_customer, 'origin', 'admin_on_behalf'),
    p_payload->>'reason'
  );
  return v_id;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- G. Platform configuration is writable by administrators (§16.7, §17.17)
--
-- 0005 gave these tables read policies only, so the CMS, the flags and the
-- business calendar were effectively frozen. Writes are administrator-only and
-- every one of them trips the audit trigger installed in section B.
-- ─────────────────────────────────────────────────────────────────────────────

create policy feature_flags_admin_write on public.feature_flags
  for all using (public.has_role(array['platform_admin','platform_superadmin']::public.app_role[]))
  with check (public.has_role(array['platform_admin','platform_superadmin']::public.app_role[]));

create policy cms_admin_write on public.cms_content
  for all using (public.has_role(array['platform_admin','platform_superadmin']::public.app_role[]))
  with check (public.has_role(array['platform_admin','platform_superadmin']::public.app_role[]));

create policy settings_admin_write on public.settings
  for all using (public.has_role(array['platform_admin','platform_superadmin']::public.app_role[]))
  with check (public.has_role(array['platform_admin','platform_superadmin']::public.app_role[]));

create policy calendar_admin_write on public.business_calendar
  for all using (public.has_role(array['platform_admin','platform_superadmin']::public.app_role[]))
  with check (public.has_role(array['platform_admin','platform_superadmin']::public.app_role[]));

create policy templates_admin_write on public.notification_templates
  for all using (public.has_role(array['platform_admin','platform_superadmin']::public.app_role[]))
  with check (public.has_role(array['platform_admin','platform_superadmin']::public.app_role[]));

-- An administrator needs to read every order to act on it, and the office needs
-- the ones in its own pool; 0004's `orders_visibility` already covers both. What
-- was missing is the office directory for staff: an archived or suspended office
-- disappeared from `offices_public_read` for everyone but its own members.
create policy offices_staff_read on public.exchange_offices
  for select using (public.is_platform_staff());

-- ─────────────────────────────────────────────────────────────────────────────
-- H. Grants (ADR 0015)
--
-- Same shape as 0011: strip the default PUBLIC EXECUTE from every function in
-- the schema, then hand it back only where a browser-side role genuinely calls
-- in. Re-running the sweep here means the eleven functions added above cannot
-- have leaked one by being forgotten.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

-- Read-only predicates the RLS policies themselves evaluate.
grant execute on function public.has_role(public.app_role[], text, uuid) to anon, authenticated;
grant execute on function public.is_platform_staff() to anon, authenticated;
grant execute on function public.is_office_member(uuid) to anon, authenticated;
grant execute on function public.impersonating(uuid) to anon, authenticated;
grant execute on function public.otp_rate_check(text, text) to anon, authenticated;

-- Signed-in entry points.
grant execute on function public.kyc_recommend(uuid, public.kyc_status, text) to authenticated;
grant execute on function public.kyc_decide(uuid, public.kyc_status, text) to authenticated;
grant execute on function public.order_advance(uuid, public.order_state, text) to authenticated;
grant execute on function public.order_claim(uuid, uuid) to authenticated;
grant execute on function public.order_actor_role(uuid) to authenticated;
grant execute on function public.order_role_may(text, public.order_state, public.order_state) to authenticated;
grant execute on function public.allowed_transitions(public.order_state) to authenticated;

-- Phase 4.
grant execute on function public.active_impersonation() to authenticated;
grant execute on function public.impersonation_start(uuid, text, int) to authenticated;
grant execute on function public.impersonation_end() to authenticated;
grant execute on function public.office_defaults() to authenticated;
grant execute on function public.admin_create_office(jsonb) to authenticated;
grant execute on function public.admin_set_office_status(uuid, text, text) to authenticated;
grant execute on function public.admin_set_office_member(uuid, uuid, public.app_role, boolean) to authenticated;
grant execute on function public.order_force_transition(uuid, public.order_state, text) to authenticated;
grant execute on function public.admin_create_order_on_behalf(jsonb) to authenticated;
