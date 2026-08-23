-- ─────────────────────────────────────────────────────────────────────────────
-- 0021 — Tickets: a thread somebody is accountable for
--
-- Support already had conversations with a status and an assignee. What it did
-- not have is the thing that makes support trackable rather than merely
-- readable: a reference the person can quote, a stated category, a clock on the
-- first reply, and a route upward when the exchange office goes quiet.
--
-- A ticket is not a second messaging system. It is a jacket around one support
-- conversation — same `messages`, same realtime, same RLS shape — carrying the
-- accountability the thread itself cannot hold.
--
-- Two rules worth stating up front, because they are the whole design:
--
--  1. **The platform sits above the office.** An office answers its own
--     tickets. If it does not, the ticket escalates and platform staff can act
--     on it directly. `ticket_escalate` is callable by the customer, by the
--     office, and by staff — a customer who has been ignored for a day should
--     not need permission to be heard.
--  2. **The history is append-only.** `ticket_events` records every state
--     change, assignment and escalation with its actor. Nothing edits it.
--     "Who decided this, and when" survives.
-- ─────────────────────────────────────────────────────────────────────────────

-- A. Types ───────────────────────────────────────────────────────────────────

do $$ begin
  create type public.ticket_state as enum (
    'open',           -- filed, nobody has replied yet
    'in_progress',    -- somebody answered and is working it
    'waiting_user',   -- the ball is with the person who filed it
    'escalated',      -- the office was too slow, or someone asked for platform
    'resolved',       -- answered; the filer can reopen
    'closed'          -- ended, no reopening
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ticket_priority as enum ('low', 'normal', 'high', 'urgent');
exception when duplicate_object then null; end $$;

-- B. Tables ──────────────────────────────────────────────────────────────────

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  public_ref text not null unique,
  conversation_id uuid not null unique references public.conversations (id),
  opened_by uuid not null references public.profiles (id),
  -- What it is about. Free-form would make the queues unsortable within a week.
  category text not null check (category in (
    'order', 'payment', 'kyc', 'p2p', 'account', 'office', 'other'
  )),
  subject text not null,
  state public.ticket_state not null default 'open',
  priority public.ticket_priority not null default 'normal',
  -- The order or trade this is about, when it is about one.
  order_id uuid references public.orders (id),
  -- The office that owns the first answer. Null means the platform owns it.
  office_id uuid references public.exchange_offices (id),
  assigned_to uuid references public.profiles (id),
  first_response_at timestamptz,
  resolved_at timestamptz,
  escalated_at timestamptz,
  escalation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists support_tickets_queue
  on public.support_tickets (state, priority desc, created_at)
  where deleted_at is null;
create index if not exists support_tickets_office
  on public.support_tickets (office_id, state) where deleted_at is null;
create index if not exists support_tickets_opener
  on public.support_tickets (opened_by, created_at desc);

create table if not exists public.ticket_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id),
  actor_id uuid references public.profiles (id),
  actor_role text,
  kind text not null,
  from_state public.ticket_state,
  to_state public.ticket_state,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists ticket_events_ticket
  on public.ticket_events (ticket_id, created_at);

-- The record of who decided what is not editable by anyone, including staff.
drop trigger if exists t_ticket_events_append_only on public.ticket_events;
create trigger t_ticket_events_append_only
  before update or delete on public.ticket_events
  for each row execute function public.forbid_mutation();

drop trigger if exists t_support_tickets_no_delete on public.support_tickets;
create trigger t_support_tickets_no_delete
  before delete on public.support_tickets
  for each row execute function public.forbid_delete();

drop trigger if exists t_support_tickets_updated on public.support_tickets;
create trigger t_support_tickets_updated before update on public.support_tickets
  for each row execute function public.set_updated_at();

-- C. Helpers ─────────────────────────────────────────────────────────────────

create or replace function public.gen_ticket_ref()
returns text language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  candidate text;
begin
  loop
    candidate := 'TKT-' || (
      select string_agg(substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1), '')
      from generate_series(1, 6)
    );
    exit when not exists (select 1 from public.support_tickets where public_ref = candidate);
  end loop;
  return candidate;
end $$;

/** How long the responsible party has before the ticket may be escalated. */
create or replace function public.ticket_response_hours()
returns int language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(
    (select (value->>'first_response_hours')::int from public.settings where key = 'support_sla'),
    24);
$$;

insert into public.settings (key, value)
values ('support_sla', jsonb_build_object(
  'first_response_hours', 24,
  'note', 'Hours the office has to answer before a ticket may be escalated to the platform.'))
on conflict (key) do nothing;

/** True when this caller may act on the ticket as the office that owns it. */
create or replace function public.ticket_is_office_side(p_ticket uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.support_tickets t
     where t.id = p_ticket
       and t.office_id is not null
       and public.is_office_member(t.office_id)
  );
$$;

-- D. Opening a ticket ────────────────────────────────────────────────────────

/**
 * File a ticket, in one call.
 *
 * Deliberately one call: the sign-in flow already asks for a phone and a code,
 * and making somebody complete a separate "create a profile" step before they
 * can say what is wrong is how support queues stay empty while people are
 * angry. Everything the ticket needs is derived here — the conversation, the
 * participant row, the reference, the routing.
 *
 * Routing: a ticket about an order goes to that order's office, because they
 * are the ones who can answer it. Everything else goes to the platform. Either
 * way `ticket_escalate` can move it up.
 */
create or replace function public.ticket_open(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_category text := lower(btrim(coalesce(p_payload->>'category', 'other')));
  v_subject text := btrim(coalesce(p_payload->>'subject', ''));
  v_body text := btrim(coalesce(p_payload->>'body', ''));
  v_order uuid := nullif(p_payload->>'order_id', '')::uuid;
  v_office uuid;
  v_conversation uuid;
  v_ticket uuid;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if v_subject = '' then raise exception 'a ticket needs a subject'; end if;
  if v_body = '' then raise exception 'a ticket needs a first message'; end if;
  if length(v_subject) > 160 then raise exception 'subject is too long'; end if;
  if v_category not in ('order','payment','kyc','p2p','account','office','other') then
    raise exception 'unknown category %', v_category;
  end if;

  -- Filing is cheap for us and free for a bot; five an hour is generous for a
  -- person and useless for a script.
  if (select count(*) from public.support_tickets
       where opened_by = v_user and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'too many tickets in the last hour; try again later';
  end if;

  -- An order may only be attached by the customer on it.
  if v_order is not null then
    if not exists (select 1 from public.orders o where o.id = v_order and o.customer_id = v_user) then
      raise exception 'that order is not yours';
    end if;
    select o.office_id into v_office from public.orders o where o.id = v_order;
  end if;

  insert into public.conversations (kind, subject_id, segment, status)
  values ('support', v_order, 'customer', 'open')
  returning id into v_conversation;

  insert into public.conversation_participants (conversation_id, user_id, role)
  values (v_conversation, v_user, 'member');

  insert into public.support_tickets (
    public_ref, conversation_id, opened_by, category, subject, order_id, office_id, priority
  )
  values (
    public.gen_ticket_ref(), v_conversation, v_user, v_category, v_subject, v_order, v_office,
    case when v_category in ('payment', 'order') then 'high' else 'normal' end::public.ticket_priority
  )
  returning id into v_ticket;

  insert into public.ticket_events (ticket_id, actor_id, actor_role, kind, to_state, note)
  values (v_ticket, v_user, 'customer', 'opened', 'open', v_subject);

  perform public.message_send(v_conversation, v_body);

  return v_ticket;
end;
$$;

-- E. Working a ticket ────────────────────────────────────────────────────────

/**
 * Move a ticket's state.
 *
 * Who may: the person who filed it (to resolve or reopen their own), the office
 * that owns it, and platform staff — who may always act, on any ticket, which
 * is the whole point of the platform sitting above the office.
 *
 * The first time anyone other than the filer moves it, the response clock
 * stops. That timestamp is what the office scorecard and the escalation rule
 * both read, so it is set here rather than trusted to a caller.
 */
create or replace function public.ticket_set_state(
  p_ticket uuid,
  p_state public.ticket_state,
  p_note text default null
) returns public.ticket_state
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  t public.support_tickets%rowtype;
  v_user uuid := auth.uid();
  v_is_staff boolean := public.is_platform_staff();
  v_is_office boolean;
  v_is_owner boolean;
  v_role text;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  select * into t from public.support_tickets where id = p_ticket and deleted_at is null for update;
  if not found then raise exception 'no such ticket'; end if;

  v_is_office := public.ticket_is_office_side(p_ticket);
  v_is_owner := t.opened_by = v_user;
  v_role := case when v_is_staff then 'platform' when v_is_office then 'office' else 'customer' end;

  if not (v_is_staff or v_is_office or v_is_owner) then
    raise exception 'not a party to this ticket';
  end if;

  -- A closed ticket is closed. Reopening one would quietly restart a clock that
  -- somebody already answered for.
  if t.state = 'closed' and not v_is_staff then
    raise exception 'this ticket is closed';
  end if;

  -- The filer may resolve or reopen their own ticket and nothing else; the
  -- rest of the states describe work only a responder can be doing.
  if v_is_owner and not (v_is_staff or v_is_office)
     and p_state not in ('resolved', 'open') then
    raise exception 'you may resolve or reopen your ticket, not set it to %', p_state;
  end if;

  update public.support_tickets
     set state = p_state,
         first_response_at = coalesce(
           first_response_at,
           case when not v_is_owner or v_is_staff or v_is_office then now() end),
         resolved_at = case when p_state in ('resolved', 'closed') then now() else null end,
         assigned_to = case
           when p_state = 'in_progress' and assigned_to is null and not v_is_owner then v_user
           else assigned_to end
   where id = p_ticket;

  insert into public.ticket_events (ticket_id, actor_id, actor_role, kind, from_state, to_state, note)
  values (p_ticket, v_user, v_role, 'state', t.state, p_state, nullif(btrim(coalesce(p_note, '')), ''));

  return p_state;
end;
$$;

/**
 * Push a ticket up to the platform.
 *
 * Callable by the customer once the office has had its stated window and said
 * nothing, by the office itself (handing over something it cannot answer), and
 * by staff at any time. The customer's path is the important one: waiting on
 * somebody who is not replying, with no way to be heard, is the failure mode
 * every support system has and nobody admits to.
 */
create or replace function public.ticket_escalate(p_ticket uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  t public.support_tickets%rowtype;
  v_user uuid := auth.uid();
  v_is_staff boolean := public.is_platform_staff();
  v_is_office boolean;
  v_waited interval;
  v_role text;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  select * into t from public.support_tickets where id = p_ticket and deleted_at is null for update;
  if not found then raise exception 'no such ticket'; end if;

  v_is_office := public.ticket_is_office_side(p_ticket);
  v_role := case when v_is_staff then 'platform' when v_is_office then 'office' else 'customer' end;

  if not (v_is_staff or v_is_office or t.opened_by = v_user) then
    raise exception 'not a party to this ticket';
  end if;

  if t.state in ('resolved', 'closed') then
    raise exception 'a settled ticket cannot be escalated; reopen it first';
  end if;
  if t.escalated_at is not null then
    raise exception 'this ticket is already with the platform';
  end if;

  -- The customer must wait out the window; the office and staff need not.
  if not (v_is_staff or v_is_office) then
    v_waited := now() - t.created_at;
    if t.first_response_at is not null then
      raise exception 'somebody has already answered; reply on the thread instead';
    end if;
    if v_waited < make_interval(hours => public.ticket_response_hours()) then
      raise exception 'the office still has time to answer; % hours from opening',
        public.ticket_response_hours();
    end if;
  end if;

  update public.support_tickets
     set state = 'escalated',
         escalated_at = now(),
         escalation_reason = nullif(btrim(coalesce(p_reason, '')), ''),
         priority = case when priority in ('low', 'normal') then 'high' else priority end,
         -- Ownership moves to the platform. The office keeps read access
         -- through its own membership, but the answer is ours now.
         assigned_to = null
   where id = p_ticket;

  insert into public.ticket_events (ticket_id, actor_id, actor_role, kind, from_state, to_state, note)
  values (p_ticket, v_user, v_role, 'escalated', t.state, 'escalated',
          nullif(btrim(coalesce(p_reason, '')), ''));
end;
$$;

-- F. Row-level security ──────────────────────────────────────────────────────

alter table public.support_tickets enable row level security;
alter table public.ticket_events enable row level security;

-- No client INSERT policy anywhere: tickets are created through `ticket_open`,
-- which is where the routing, the rate limit and the ownership check live
-- (ADR 0017).
drop policy if exists tickets_readable on public.support_tickets;
create policy tickets_readable on public.support_tickets
  for select using (
    deleted_at is null
    and (
      opened_by = auth.uid()
      or public.is_platform_staff()
      or (office_id is not null and public.is_office_member(office_id))
    )
  );

drop policy if exists ticket_events_readable on public.ticket_events;
create policy ticket_events_readable on public.ticket_events
  for select using (
    exists (
      select 1 from public.support_tickets t
       where t.id = ticket_events.ticket_id
         and t.deleted_at is null
         and (
           t.opened_by = auth.uid()
           or public.is_platform_staff()
           or (t.office_id is not null and public.is_office_member(t.office_id))
         )
    )
  );

-- G. Grants ──────────────────────────────────────────────────────────────────

revoke all on function public.gen_ticket_ref() from public;
revoke all on function public.ticket_response_hours() from public;
revoke all on function public.ticket_is_office_side(uuid) from public;
revoke all on function public.ticket_open(jsonb) from public;
revoke all on function public.ticket_set_state(uuid, public.ticket_state, text) from public;
revoke all on function public.ticket_escalate(uuid, text) from public;

grant execute on function public.ticket_response_hours() to authenticated;
grant execute on function public.ticket_is_office_side(uuid) to authenticated;
grant execute on function public.ticket_open(jsonb) to authenticated;
grant execute on function public.ticket_set_state(uuid, public.ticket_state, text) to authenticated;
grant execute on function public.ticket_escalate(uuid, text) to authenticated;

grant select on public.support_tickets to authenticated;
grant select on public.ticket_events to authenticated;
