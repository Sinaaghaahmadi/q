-- ─────────────────────────────────────────────────────────────────────────────
-- Two things that only show up once a real client drives the flow.
--
-- 1. A submitted order was a dead end. `submitted -> matching` is a platform
--    transition and there is no scheduler, so an order would have sat in
--    `submitted` forever and no office would ever have seen it. Routing is not
--    a decision anyone makes — it is what submission means — so order_advance
--    does it in the same transaction, through assert_transition like everything
--    else so it gets its own order_events row. actor_id is null and the role is
--    'platform': nobody pressed a button, and the timeline should say so rather
--    than crediting the customer.
--
-- 2. set_order_public_ref was not SECURITY DEFINER. Postgres does not check
--    EXECUTE on a *trigger function* against the user running the statement,
--    but it does check every call made *inside* it — and 0011 had (correctly)
--    revoked gen_public_ref. So every order insert by a signed-in customer
--    failed with "permission denied for function gen_public_ref". 0011's probe
--    missed it by running as the owner, who has EXECUTE either way; it only
--    appears when a real `authenticated` role inserts the row.
-- ─────────────────────────────────────────────────────────────────────────────

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
  elsif p_to = 'submitted' then
    perform public.assert_transition(
      p_order, 'submitted', 'matching', null, 'platform', 'routed to the matching pool', null
    );
    return 'matching';
  end if;

  return p_to;
end $$;

-- Reachable only through the trigger, and its own EXECUTE stays revoked, so
-- running as owner grants nothing that inserting the row did not already imply.
create or replace function public.set_order_public_ref()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.public_ref is null or new.public_ref = '' then
    new.public_ref := public.gen_public_ref();
  end if;
  return new;
end $$;

revoke all on function public.order_advance(uuid, public.order_state, text) from public, anon, authenticated;
grant execute on function public.order_advance(uuid, public.order_state, text) to authenticated;
revoke all on function public.set_order_public_ref() from public, anon, authenticated;
