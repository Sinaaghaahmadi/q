-- 0007 — Hardening pass driven by the Supabase security linter (§15).
--
-- Two classes of finding, both real:
--   1. Functions without a pinned `search_path` can be hijacked by a caller
--      that puts a same-named object in an earlier schema.
--   2. SECURITY DEFINER functions are exposed over PostgREST as RPC unless
--      EXECUTE is revoked. Only the ones that self-check the caller's role
--      stay reachable by signed-in users; the rest are server-side only.

-- ── 1. Pin search_path on every function we own ─────────────────────────────
alter function public.set_updated_at() set search_path = public;
alter function public.forbid_mutation() set search_path = public;
alter function public.is_platform_staff() set search_path = public;
alter function public.is_office_member(uuid) set search_path = public;
alter function public.allowed_transitions(public.order_state) set search_path = public;
alter function public.assert_txn_balanced() set search_path = public;

-- ── 2. Close the RPC surface ────────────────────────────────────────────────
-- Trigger-only functions: never callable directly.
revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.sync_profile_phone() from anon, authenticated;
revoke execute on function public.set_updated_at() from anon, authenticated;
revoke execute on function public.forbid_mutation() from anon, authenticated;
revoke execute on function public.assert_txn_balanced() from anon, authenticated;

-- The order state machine is driven server-side only (§8.1: "the client cannot
-- patch orders.state directly"). Service role keeps EXECUTE implicitly.
revoke execute on function public.assert_transition(
  uuid, public.order_state, public.order_state, uuid, text, text, integer
) from anon, authenticated;

-- Role helpers are needed inside RLS policies for signed-in users, but a
-- signed-out caller has no business probing them.
revoke execute on function public.has_role(public.app_role[], text, uuid) from anon;
revoke execute on function public.is_platform_staff() from anon;
revoke execute on function public.is_office_member(uuid) from anon;

-- KYC decisions self-check the caller's role and enforce four-eyes, so signed-in
-- staff may call them; anonymous callers may not reach them at all.
revoke execute on function public.kyc_recommend(uuid, public.kyc_status, text) from anon;
revoke execute on function public.kyc_decide(uuid, public.kyc_status, text) from anon;

-- ── 3. Make the otp_attempts lockdown explicit ──────────────────────────────
-- The table is written and read by the service role only; an explicit
-- deny-all policy states that intent instead of leaving RLS policy-less.
create policy otp_attempts_no_client_access on public.otp_attempts
  for all to anon, authenticated
  using (false) with check (false);
