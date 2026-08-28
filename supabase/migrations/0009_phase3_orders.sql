-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 3 — order lifecycle (§8)
--
-- 0004 gave us the state machine and the ledger. This adds the layer the app
-- calls: who is allowed to make which transition, and what money movement each
-- one records. `assert_transition` stays revoked from clients — it trusts the
-- actor it is handed — so everything here derives the actor from auth.uid()
-- and works out the caller's role itself.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Public reference (§17.2) ────────────────────────────────────────────────
-- Crockford-ish alphabet: no I, L, O or U, so a reference read down a phone
-- line cannot come back as a different order.
create or replace function public.gen_public_ref()
returns text language plpgsql volatile set search_path = public as $$
declare
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  candidate text;
begin
  loop
    candidate := 'ASA-' || (
      select string_agg(substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1), '')
      from generate_series(1, 6)
    );
    exit when not exists (select 1 from public.orders where public_ref = candidate);
  end loop;
  return candidate;
end $$;

create or replace function public.set_order_public_ref()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.public_ref is null or new.public_ref = '' then
    new.public_ref := public.gen_public_ref();
  end if;
  return new;
end $$;

-- NOT NULL stays: a BEFORE INSERT trigger runs before the constraint is
-- checked, so the column is filled by the time it matters.
create trigger t_orders_public_ref
  before insert on public.orders
  for each row execute function public.set_order_public_ref();

-- ── Who is the caller, relative to one order? ───────────────────────────────
create or replace function public.order_actor_role(p_order uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when public.is_platform_staff() then 'platform'
    when exists (
      select 1 from public.orders o
      where o.id = p_order and o.office_id is not null
        and public.is_office_member(o.office_id)
    ) then 'office'
    when exists (
      select 1 from public.orders o where o.id = p_order and o.customer_id = auth.uid()
    ) then 'customer'
    else null
  end;
$$;

-- ── The permission matrix (§8.1) ────────────────────────────────────────────
-- Read this as the answer to "may a <role> move an order from <from> to <to>?".
-- Platform staff are deliberately not a wildcard: they may resolve and reverse,
-- but they cannot fabricate the customer's confirmation that money arrived.
create or replace function public.order_role_may(
  p_role text,
  p_from public.order_state,
  p_to public.order_state
) returns boolean language sql immutable set search_path = public as $$
  select case p_role
    when 'customer' then (p_from, p_to) in (
      ('draft','submitted'),
      ('draft','cancelled'), ('submitted','cancelled'), ('matching','cancelled'),
      ('office_review','cancelled'), ('info_needed','cancelled'),
      ('accepted','cancelled'), ('awaiting_irt_funding','cancelled'),
      -- the recipient is the only party who can say the money arrived
      ('foreign_leg_sent','recipient_confirmed'),
      ('irt_funded','disputed'), ('foreign_leg_pending','disputed'),
      ('foreign_leg_sent','disputed'), ('recipient_confirmed','disputed')
    )
    when 'office' then (p_from, p_to) in (
      ('matching','office_review'),
      ('office_review','accepted'), ('office_review','info_needed'),
      ('info_needed','office_review'),
      ('accepted','awaiting_irt_funding'),
      ('awaiting_irt_funding','irt_funded'),
      ('irt_funded','foreign_leg_pending'),
      ('foreign_leg_pending','foreign_leg_sent'),
      ('foreign_leg_pending','on_hold'), ('foreign_leg_sent','on_hold'),
      ('on_hold','foreign_leg_pending'), ('on_hold','foreign_leg_sent'),
      ('recipient_confirmed','irt_released'),
      ('irt_released','completed'),
      ('irt_funded','disputed'), ('foreign_leg_pending','disputed'),
      ('foreign_leg_sent','disputed')
    )
    when 'platform' then (p_from, p_to) in (
      ('submitted','matching'), ('matching','office_review'),
      ('office_review','info_needed'), ('info_needed','office_review'),
      ('irt_funded','disputed'), ('foreign_leg_pending','disputed'),
      ('foreign_leg_sent','disputed'), ('recipient_confirmed','disputed'),
      ('foreign_leg_pending','on_hold'), ('foreign_leg_sent','on_hold'),
      ('on_hold','foreign_leg_pending'), ('on_hold','foreign_leg_sent'),
      ('on_hold','disputed'),
      ('disputed','on_hold'), ('disputed','refunded'), ('disputed','completed'),
      ('disputed','sla_breached'),
      ('irt_funded','refunded'), ('on_hold','refunded'),
      ('irt_released','completed'),
      ('draft','cancelled'), ('submitted','cancelled'), ('matching','cancelled'),
      ('office_review','cancelled'), ('accepted','cancelled'),
      ('awaiting_irt_funding','cancelled'), ('info_needed','cancelled')
    )
    else false
  end;
$$;

-- ── Ledger helpers (§11, §17.1) ─────────────────────────────────────────────
create or replace function public.ledger_account(
  p_owner_type text, p_owner_id uuid, p_currency text, p_code text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select id into v_id from public.ledger_accounts
    where owner_type = p_owner_type
      and owner_id is not distinct from p_owner_id
      and currency = p_currency and code = p_code;
  if v_id is null then
    insert into public.ledger_accounts (owner_type, owner_id, currency, code)
      values (p_owner_type, p_owner_id, p_currency, p_code)
      returning id into v_id;
  end if;
  return v_id;
end $$;

/**
 * Funding: the Toman leg arrives into platform-supervised holding and the
 * customer gains a claim on it. Nothing is owed to the office yet — that is
 * exactly the point of funding first (§8.1).
 */
create or replace function public.post_order_funding(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  o public.orders%rowtype;
  v_txn uuid := gen_random_uuid();
  v_toman bigint;
begin
  select * into o from public.orders where id = p_order;
  v_toman := case when o.send_currency = 'IRT' then o.send_amount_minor
                  else o.receive_amount_minor end;

  insert into public.ledger_entries (txn_id, ledger_account_id, direction, amount_minor, currency, order_id, memo)
  values
    (v_txn, public.ledger_account('suspense', null, 'IRT', 'irt_holding'),
     'debit', v_toman, 'IRT', p_order, 'toman leg funded'),
    (v_txn, public.ledger_account('customer', o.customer_id, 'IRT', 'irt_payable'),
     'credit', v_toman, 'IRT', p_order, 'toman leg funded');
end $$;

/**
 * Release: the customer's claim is discharged and split into the platform fee,
 * the office fee, and the office's settlement balance. The holding account
 * stays debited until the office physically withdraws — an escrow balance is
 * supposed to sit there, and pretending otherwise would hide real money.
 */
create or replace function public.post_order_release(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  o public.orders%rowtype;
  v_txn uuid := gen_random_uuid();
  v_toman bigint;
  v_net bigint;
begin
  select * into o from public.orders where id = p_order;
  v_toman := case when o.send_currency = 'IRT' then o.send_amount_minor
                  else o.receive_amount_minor end;
  v_net := v_toman - o.platform_fee_minor - o.office_fee_minor;
  if v_net <= 0 then
    raise exception 'order %: fees (% + %) exceed the toman leg (%)',
      p_order, o.platform_fee_minor, o.office_fee_minor, v_toman;
  end if;

  insert into public.ledger_entries (txn_id, ledger_account_id, direction, amount_minor, currency, order_id, memo)
  values
    (v_txn, public.ledger_account('customer', o.customer_id, 'IRT', 'irt_payable'),
     'debit', v_toman, 'IRT', p_order, 'toman released'),
    (v_txn, public.ledger_account('platform', null, 'IRT', 'irt_fees'),
     'credit', o.platform_fee_minor, 'IRT', p_order, 'platform fee'),
    (v_txn, public.ledger_account('office', o.office_id, 'IRT', 'irt_fees'),
     'credit', o.office_fee_minor, 'IRT', p_order, 'office fee'),
    (v_txn, public.ledger_account('office', o.office_id, 'IRT', 'irt_settlement'),
     'credit', v_net, 'IRT', p_order, 'office settlement');
end $$;

-- ── The one entry point the app calls ───────────────────────────────────────
create or replace function public.order_advance(
  p_order uuid,
  p_to public.order_state,
  p_reason text default null
) returns public.order_state language plpgsql security definer set search_path = public as $$
declare
  o public.orders%rowtype;
  v_role text;
  v_kyc public.kyc_status;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into o from public.orders where id = p_order;
  if o.id is null then
    raise exception 'order not found';
  end if;

  v_role := public.order_actor_role(p_order);
  if v_role is null then
    raise exception 'not a party to this order';
  end if;
  if not public.order_role_may(v_role, o.state, p_to) then
    raise exception '% may not move an order from % to %', v_role, o.state, p_to;
  end if;

  -- Submitting is where identity and a destination stop being optional (§6).
  if p_to = 'submitted' then
    select kyc_status into v_kyc from public.profiles where id = o.customer_id;
    if v_kyc is distinct from 'approved' then
      raise exception 'identity is not verified';
    end if;
    if o.destination_account_id is null then
      raise exception 'order has no destination account';
    end if;
    if o.rate_expires_at <= now() then
      raise exception 'the locked rate has expired';
    end if;
  end if;

  -- A cancellation after funding would strand money; that is what refund is for.
  if p_to = 'cancelled' and o.state in ('irt_funded','foreign_leg_pending','foreign_leg_sent') then
    raise exception 'a funded order is refunded, never cancelled';
  end if;

  perform public.assert_transition(p_order, o.state, p_to, auth.uid(), v_role, p_reason, o.version);

  if p_to = 'irt_funded' then
    perform public.post_order_funding(p_order);
  elsif p_to = 'irt_released' then
    perform public.post_order_release(p_order);
  end if;

  return p_to;
end $$;

/**
 * Claiming is the one transition that also assigns the office, so it cannot go
 * through order_advance — before it runs the caller is not yet a party.
 */
create or replace function public.order_claim(p_order uuid, p_office uuid)
returns public.order_state language plpgsql security definer set search_path = public as $$
declare o public.orders%rowtype;
begin
  if not public.is_office_member(p_office) then
    raise exception 'not a member of that office';
  end if;
  if not exists (select 1 from public.exchange_offices where id = p_office and status = 'active') then
    raise exception 'office is not active';
  end if;

  select * into o from public.orders where id = p_order for update;
  if o.id is null then
    raise exception 'order not found';
  end if;
  if o.office_id is not null then
    raise exception 'order is already claimed';
  end if;
  if o.state <> 'matching' then
    raise exception 'order is in state %, not matching', o.state;
  end if;

  update public.orders set office_id = p_office where id = p_order;
  perform public.assert_transition(p_order, 'matching', 'office_review', auth.uid(), 'office', 'claimed', o.version);
  return 'office_review';
end $$;

-- ── RLS additions ───────────────────────────────────────────────────────────
-- An office cannot claim what it cannot see: unclaimed orders in the matching
-- pool are visible to any member of an active office.
create policy orders_matching_pool on public.orders
  for select using (
    office_id is null
    and state = 'matching'
    and exists (
      select 1 from public.memberships m
      join public.exchange_offices e on e.id = m.scope_id
      where m.user_id = auth.uid() and m.deleted_at is null
        and m.scope_type = 'office' and e.status = 'active'
    )
  );

-- Customers attach the Toman receipt; offices attach the foreign-leg proof.
create policy order_documents_insert on public.order_documents
  for insert with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.orders o
      where o.id = order_id
        and (
          (o.customer_id = auth.uid() and kind = 'irt_receipt')
          or (o.office_id is not null and public.is_office_member(o.office_id)
              and kind in ('swift_mt103','foreign_receipt','invoice'))
        )
    )
  );

-- Customers may edit their own draft and nothing else; state never moves here.
create policy orders_update_own_draft on public.orders
  for update using (customer_id = auth.uid() and state = 'draft')
  with check (customer_id = auth.uid() and state = 'draft');

-- ── Grants (§15) ────────────────────────────────────────────────────────────
revoke execute on function public.gen_public_ref() from anon, authenticated;
revoke execute on function public.set_order_public_ref() from anon, authenticated;
revoke execute on function public.ledger_account(text, uuid, text, text) from anon, authenticated;
revoke execute on function public.post_order_funding(uuid) from anon, authenticated;
revoke execute on function public.post_order_release(uuid) from anon, authenticated;
revoke execute on function public.order_actor_role(uuid) from anon;
revoke execute on function public.order_role_may(text, public.order_state, public.order_state) from anon;
revoke execute on function public.order_advance(uuid, public.order_state, text) from anon;
revoke execute on function public.order_claim(uuid, uuid) from anon;
