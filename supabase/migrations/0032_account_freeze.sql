-- 0032 — freezing a customer account, from the console
--
-- `profiles` has had exactly one write policy since 0002: `profiles_self_update`,
-- scoped to `id = auth.uid()`. That is the right default — nobody edits anybody
-- else's name — but it also meant the one administrative act the table exists to
-- support could not be performed. /admin/users/[id] carried a freeze control that
-- was permanently disabled with a paragraph explaining why, which is honest and
-- is not a feature.
--
-- The way in is a SECURITY DEFINER function rather than a wider policy, for the
-- same reason `order_force_transition` is: a policy would let an administrator
-- write *any* column on *any* profile, and this needs to write exactly two, on
-- exactly the rows a person is entitled to act on, with a reason that outlives
-- them. Compliance holds this power alongside admin and superadmin — freezing an
-- account is the compliance response to a sanctions hit, and routing it through
-- an administrator would put a second person between the finding and the act.
--
-- Support is deliberately *not* included. A support agent who can freeze an
-- account can lock a customer out of their own money over a disagreement, and
-- the seat is not scoped tightly enough for that.

create or replace function public.profile_set_frozen(
  p_user uuid,
  p_frozen boolean,
  p_reason text
) returns timestamptz language plpgsql security definer set search_path = public as $$
declare
  v_before public.profiles%rowtype;
  v_at timestamptz;
begin
  if not public.has_role(
    array['platform_admin','platform_superadmin','platform_compliance']::public.app_role[]
  ) then
    raise exception 'only a platform administrator or compliance officer may freeze an account';
  end if;

  -- A reason, always, in both directions. "Why is this account closed" and "why
  -- was it reopened" are the same question asked at two different times, and the
  -- audit log is the only place either answer survives a staff change.
  if coalesce(length(btrim(coalesce(p_reason, ''))), 0) < 8 then
    raise exception 'freezing or unfreezing an account requires a written reason';
  end if;

  select * into v_before from public.profiles where id = p_user;
  if v_before.id is null then
    raise exception 'no such account';
  end if;

  -- Nobody freezes themselves out of the console they are holding.
  if p_user = auth.uid() then
    raise exception 'an account cannot freeze itself';
  end if;

  -- Staff accounts are not frozen from here. Removing somebody's access is a
  -- membership change with its own trail; freezing the profile would leave the
  -- seat in place and the reason in the wrong record.
  if exists (
    select 1 from public.memberships m
    where m.user_id = p_user and m.deleted_at is null and m.scope_type = 'platform'
  ) then
    raise exception 'platform staff accounts are not frozen from the customer console';
  end if;

  if p_frozen and v_before.frozen_at is not null then
    raise exception 'this account is already frozen';
  end if;
  if not p_frozen and v_before.frozen_at is null then
    raise exception 'this account is not frozen';
  end if;

  v_at := case when p_frozen then now() else null end;

  update public.profiles
     set frozen_at = v_at,
         frozen_reason = case when p_frozen then btrim(p_reason) else null end
   where id = p_user;

  perform public.audit_event(
    case when p_frozen then 'profile.freeze' else 'profile.unfreeze' end,
    'profiles', p_user,
    jsonb_build_object('frozen_at', v_before.frozen_at, 'frozen_reason', v_before.frozen_reason),
    jsonb_build_object('frozen_at', v_at, 'frozen_reason', case when p_frozen then btrim(p_reason) end),
    btrim(p_reason)
  );

  return v_at;
end $$;

revoke all on function public.profile_set_frozen(uuid, boolean, text) from public;
grant execute on function public.profile_set_frozen(uuid, boolean, text) to authenticated;

-- What being frozen actually costs, stated in the database rather than in the
-- interface. Without this the flag is decoration: the customer's own update
-- policy already refuses a frozen row, but nothing stopped a frozen account from
-- opening a new order, which is the thing a freeze is for.
drop policy if exists orders_insert_draft on public.orders;
create policy orders_insert_draft on public.orders
  for insert with check (
    customer_id = auth.uid()
    and state = 'draft'
    and not exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.frozen_at is not null
    )
  );
