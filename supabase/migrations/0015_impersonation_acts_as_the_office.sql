-- 0015 — Standing in for an office means acting as it (§16.3)
--
-- 0014 made `is_office_member` consult a live impersonation, which opened every
-- office screen and every office-scoped row to the administrator. It did not
-- open the office's *actions*, and writing the runbook is what surfaced why:
-- `order_actor_role` tests platform staff first, so an impersonating superadmin
-- — who is by definition platform staff — resolved as 'platform' and got the
-- platform matrix. That matrix is deliberately narrow (§8.1: staff may resolve
-- and reverse, never fabricate progress), so it has no `accepted →
-- awaiting_irt_funding` and no `foreign_leg_pending → foreign_leg_sent`. The
-- administrator could read the office's workspace and press nothing in it,
-- which makes "act on their behalf" untrue.
--
-- The fix is ordering, not a new permission: an active impersonation of *this
-- order's office* answers first, and the caller acts with the office's matrix.
-- Nothing widens — the office matrix still cannot confirm receipt on the
-- customer's behalf — and the audit trail is unchanged, because
-- `assert_transition` records auth.uid(), which is still the administrator's.
--
-- Forcing a transition is untouched by this: `order_force_transition` never
-- consulted `order_actor_role` and still checks the platform role directly.

create or replace function public.order_actor_role(p_order uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when exists (
      select 1 from public.orders o
      where o.id = p_order and o.office_id is not null
        and public.impersonating(o.office_id)
    ) then 'office'
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

-- CREATE OR REPLACE keeps the existing ACL, but say it out loud rather than
-- rely on that: this function is called from the browser by design.
revoke all on function public.order_actor_role(uuid) from public, anon;
grant execute on function public.order_actor_role(uuid) to authenticated;
