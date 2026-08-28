-- 0016 — Phase 5: conversations (§10)
--
-- 0005 built the engine — `conversations`, `conversation_participants`,
-- `messages`, append-only, with read policies. What was missing is everything
-- that decides *who is in a conversation and when it opens*, which is where the
-- product requirements actually live:
--
--   §10.1  order chat opens at `office_review` — before acceptance, on purpose.
--          People must be able to ask before they commit.
--   §10.3  support is one engine with three queues, segmented by who is asking.
--   §8.3   the office's internal notes never reach the customer.
--   §10    messages are immutable; an edit is a new revision, not a rewrite.
--
-- Membership is never something a client asserts. `conversations` and
-- `conversation_participants` have no INSERT policy at all, so the only way in
-- is through the two SECURITY DEFINER openers below, which derive the roster
-- from the order or from the caller's own seats.

-- ─────────────────────────────────────────────────────────────────────────────
-- A. Soft flags (§10)
--
-- Off-platform settlement is the failure this business actually has: the two
-- parties agree in chat to move the money outside the supervised flow, and the
-- platform loses both the ledger and the dispute. Detection is deliberately a
-- *flag*, never a block — a false positive must not stop a real conversation,
-- and compliance would rather read a noisy queue than a censored one.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.message_flags(p_body text)
returns jsonb language sql immutable set search_path = public as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'off_platform', case when p_body ~* (
        'telegram|whats\s?app|واتس\s?اپ|تلگرام|ایتا|بله\s*مسنجر'
        '|خارج از (سایت|پلتفرم|سامانه)|off.?platform|outside the (platform|app|site)'
        '|کارت به کارت مستقیم|direct(ly)? to my (card|account)'
      ) then true end,
    -- A bare card or IBAN in free text: settlement details belong on the
    -- account record, where they are validated and shown with the order.
    'account_number', case when p_body ~ '(\m\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\M)|(\mIR\d{24}\M)'
      then true end,
    'contact', case when p_body ~* '(\+?\d[\d\s-]{9,}\d)|([[:alnum:]._%+-]+@[[:alnum:].-]+\.[a-z]{2,})'
      then true end
  ));
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- B. Opening a conversation
-- ─────────────────────────────────────────────────────────────────────────────

/**
 * The conversation attached to an order, created on first use. Open from
 * `office_review` — the moment an office is looking at the order — so a
 * customer can negotiate before anyone has committed to anything (§10.1).
 *
 * The roster is derived, not asserted: the customer, plus every current member
 * of the office holding the order. Platform staff are deliberately *not*
 * participants — they read through `is_platform_staff()` in 0005's policy, so
 * oversight never silently adds a name to the customer's conversation.
 */
create or replace function public.conversation_for_order(p_order uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  o public.orders%rowtype;
  v_id uuid;
begin
  if public.order_actor_role(p_order) is null then
    raise exception 'not a party to this order';
  end if;

  select * into o from public.orders where id = p_order;
  if o.id is null then raise exception 'order not found'; end if;
  if o.office_id is null or o.state in ('draft','submitted','matching') then
    raise exception 'this order has no exchange office to talk to yet';
  end if;

  select id into v_id from public.conversations
   where kind = 'order' and subject_id = p_order and deleted_at is null;

  if v_id is null then
    insert into public.conversations (kind, subject_id, status)
    values ('order', p_order, 'open') returning id into v_id;
  end if;

  insert into public.conversation_participants (conversation_id, user_id, role)
  select v_id, o.customer_id, 'customer'
  on conflict (conversation_id, user_id) do update set deleted_at = null;

  insert into public.conversation_participants (conversation_id, user_id, role)
  select v_id, m.user_id, 'office'
    from public.memberships m
   where m.scope_type = 'office' and m.scope_id = o.office_id and m.deleted_at is null
  on conflict (conversation_id, user_id) do update set deleted_at = null;

  return v_id;
end $$;

/**
 * The caller's support conversation (§10.3). The segment is derived from who
 * they are rather than asked for, so the three admin queues stay honest: an
 * exchange office cannot file itself into the customer queue to jump it.
 */
create or replace function public.conversation_for_support()
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_segment public.support_segment;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  v_segment := case
    when exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid() and m.scope_type = 'office' and m.deleted_at is null
    ) then 'office'
    when exists (
      select 1 from public.p2p_offers p where p.user_id = auth.uid() and p.deleted_at is null
    ) then 'p2p'
    else 'customer'
  end::public.support_segment;

  select c.id into v_id
    from public.conversations c
    join public.conversation_participants p on p.conversation_id = c.id
   where c.kind = 'support' and p.user_id = auth.uid()
     and c.status in ('open','pending') and c.deleted_at is null
   order by c.created_at desc
   limit 1;

  if v_id is null then
    insert into public.conversations (kind, segment, status, sla_due_at)
    values ('support', v_segment, 'open', now() + interval '1 day')
    returning id into v_id;

    insert into public.conversation_participants (conversation_id, user_id, role)
    values (v_id, auth.uid(), 'requester')
    on conflict (conversation_id, user_id) do nothing;
  end if;

  return v_id;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- C. Sending, reading, assigning
-- ─────────────────────────────────────────────────────────────────────────────

/**
 * The one way a message is written. 0005's INSERT policy would already accept a
 * direct insert from a participant, and that is fine — but it cannot set
 * `last_message_at`, cannot compute the flags, and would let a customer mark
 * their own message an internal note. This does all three, so the client never
 * has to be trusted with any of it.
 */
create or replace function public.message_send(
  p_conversation uuid,
  p_body text,
  p_internal boolean default false
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_body text := btrim(coalesce(p_body, ''));
  v_staff boolean;
  v_office boolean;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if length(v_body) = 0 then raise exception 'a message needs a body'; end if;
  if length(v_body) > 4000 then raise exception 'that message is too long'; end if;

  v_staff := public.is_platform_staff();
  if not v_staff and not exists (
    select 1 from public.conversation_participants p
    where p.conversation_id = p_conversation and p.user_id = auth.uid() and p.deleted_at is null
  ) then
    raise exception 'not a participant in this conversation';
  end if;

  -- An internal note is a note *about* the customer, so only the two sides that
  -- are not the customer may write one (§8.3).
  v_office := exists (
    select 1 from public.conversations c
    join public.orders o on o.id = c.subject_id
    where c.id = p_conversation and c.kind = 'order'
      and o.office_id is not null and public.is_office_member(o.office_id)
  );
  if p_internal and not (v_staff or v_office) then
    raise exception 'only the office or platform staff may write an internal note';
  end if;

  insert into public.messages (conversation_id, sender_id, body, is_internal_note, flags)
  values (p_conversation, auth.uid(), v_body, coalesce(p_internal, false),
          public.message_flags(v_body))
  returning id into v_id;

  update public.conversations
     set last_message_at = now(),
         -- A staff reply answers the clock; anyone else's restarts it.
         status = case when kind = 'support' and not v_staff then 'open' else status end
   where id = p_conversation;

  return v_id;
end $$;

create or replace function public.conversation_mark_read(p_conversation uuid)
returns void language sql security definer set search_path = public as $$
  update public.conversation_participants
     set last_read_at = now()
   where conversation_id = p_conversation and user_id = auth.uid();
$$;

/** Assign a support conversation to a member of staff, or resolve it (§16.6). */
create or replace function public.support_set_state(
  p_conversation uuid,
  p_status text default null,
  p_assign boolean default false
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_staff() then
    raise exception 'only platform staff may triage the support inbox';
  end if;
  if p_status is not null and p_status not in ('open','pending','resolved','archived') then
    raise exception 'unknown conversation status %', p_status;
  end if;

  update public.conversations
     set assigned_to = case when p_assign then auth.uid() else assigned_to end,
         status = coalesce(p_status, status)
   where id = p_conversation and kind = 'support';

  -- Staff answering are participants from then on, so their replies are theirs
  -- rather than an anonymous "platform" voice.
  if p_assign then
    insert into public.conversation_participants (conversation_id, user_id, role)
    values (p_conversation, auth.uid(), 'agent')
    on conflict (conversation_id, user_id) do update set deleted_at = null;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- D. Policies
-- ─────────────────────────────────────────────────────────────────────────────

-- 0005's write policy let any participant set `is_internal_note`, which would
-- have let a customer file a message their own side could not see. Replaced by
-- one that ties the flag to who is writing.
drop policy if exists messages_participant_write on public.messages;
create policy messages_participant_write on public.messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversation_participants p
      where p.conversation_id = messages.conversation_id
        and p.user_id = auth.uid() and p.deleted_at is null
    )
    and (
      not is_internal_note
      or public.is_platform_staff()
      or exists (
        select 1 from public.conversations c
        join public.orders o on o.id = c.subject_id
        where c.id = messages.conversation_id and c.kind = 'order'
          and o.office_id is not null and public.is_office_member(o.office_id)
      )
    )
  );

-- Read receipts and mute are the participant's own to set; nothing else on the
-- row is.
create policy participants_update_own on public.conversation_participants
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy conversations_staff_triage on public.conversations
  for update using (public.is_platform_staff())
  with check (public.is_platform_staff());

create trigger t_conversations_no_delete before delete on public.conversations
  for each row execute function public.forbid_delete();
create trigger t_conversation_participants_no_delete before delete on public.conversation_participants
  for each row execute function public.forbid_delete();

-- Realtime delivery (§10). Only `messages` is published: a client watching a
-- conversation it cannot read gets nothing, because Realtime applies the same
-- RLS policy to every broadcast row.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
    ) then
      execute 'alter publication supabase_realtime add table public.messages';
    end if;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- E. Grants (ADR 0015)
-- ─────────────────────────────────────────────────────────────────────────────

revoke all on function public.message_flags(text) from public, anon, authenticated;
revoke all on function public.conversation_for_order(uuid) from public, anon, authenticated;
revoke all on function public.conversation_for_support() from public, anon, authenticated;
revoke all on function public.message_send(uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.conversation_mark_read(uuid) from public, anon, authenticated;
revoke all on function public.support_set_state(uuid, text, boolean) from public, anon, authenticated;

grant execute on function public.conversation_for_order(uuid) to authenticated;
grant execute on function public.conversation_for_support() to authenticated;
grant execute on function public.message_send(uuid, text, boolean) to authenticated;
grant execute on function public.conversation_mark_read(uuid) to authenticated;
grant execute on function public.support_set_state(uuid, text, boolean) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- F. The conversation list was never visible to anyone in it
--
-- 0005 wrote:
--
--   create policy conversations_participant on public.conversations
--     for select using (... exists (
--       select 1 from public.conversation_participants p
--       where p.conversation_id = id and ...));
--
-- `conversation_participants` has its own `id` column, so the unqualified `id`
-- bound to the *inner* table, not the outer one. Postgres stored it as
-- `p.conversation_id = p.id` — a row's foreign key compared to its own primary
-- key, false for every row ever written. The policy therefore reduced to
-- `is_platform_staff()`: every conversation was invisible to the customer and
-- the office who were in it, and staff saw everything.
--
-- Nothing had exercised it until Phase 5 gave conversations a reader. It also
-- silently disabled the internal-note branch of `messages_participant_read`,
-- whose subquery joins `conversations` — so office notes were hidden from the
-- office too, which is how it was noticed.
--
-- A scan of every policy in the schema found this one and no others; a pgTAP
-- assertion now fails on any policy that compares an alias to itself.
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists conversations_participant on public.conversations;
create policy conversations_participant on public.conversations
  for select using (
    public.is_platform_staff()
    or exists (
      select 1 from public.conversation_participants p
      where p.conversation_id = conversations.id
        and p.user_id = auth.uid()
        and p.deleted_at is null
    )
  );
