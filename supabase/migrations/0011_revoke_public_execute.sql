-- ─────────────────────────────────────────────────────────────────────────────
-- The hardening in 0007 (and the same pattern in 0009) did not work.
--
--   revoke execute on function ... from anon, authenticated;
--
-- Postgres grants EXECUTE to PUBLIC on every function it creates, and
-- anon/authenticated inherit it through PUBLIC. A revoke aimed at the roles
-- never touches that grant, so every ACL still read `=X/postgres` — PUBLIC
-- keeps EXECUTE — and the linter was right to keep flagging them.
--
-- What that left exposed over PostgREST to anyone holding the publishable key:
--
--   * assert_transition — takes p_actor and p_actor_role as parameters and
--     trusts them. A customer could drive any order to any state the machine
--     permits, and write the order_event attributing it to somebody else.
--   * post_order_funding / post_order_release — write double-entry ledger rows
--     with no authorization check at all, against any order id.
--   * ledger_account — creates ledger accounts on demand.
--
-- ADR 0010 says RLS is the security boundary and the app holds no service-role
-- key. These functions are SECURITY DEFINER precisely so they can cross that
-- boundary, which is exactly why they must not be reachable from the API.
--
-- Deny by default across the schema, then grant back only what a client is
-- meant to call. Trigger functions need no grant: Postgres does not check
-- EXECUTE on a trigger function against the user running the statement — the
-- probe in this migration's commit verifies that all three still fire.
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

-- Caller-scoped predicates. They take no identity argument — they answer only
-- about auth.uid() — and RLS policies call them, so they must stay executable
-- by the roles those policies run as.
grant execute on function public.has_role(public.app_role[], text, uuid) to anon, authenticated;
grant execute on function public.is_platform_staff() to anon, authenticated;
grant execute on function public.is_office_member(uuid) to anon, authenticated;

-- Sign-in happens before there is a session, so the rate check needs anon.
grant execute on function public.otp_rate_check(text, text) to anon, authenticated;

-- The RPCs the app calls for a signed-in user. Each derives the actor from
-- auth.uid() and checks the caller's role itself.
grant execute on function public.kyc_recommend(uuid, public.kyc_status, text) to authenticated;
grant execute on function public.kyc_decide(uuid, public.kyc_status, text) to authenticated;
grant execute on function public.order_advance(uuid, public.order_state, text) to authenticated;
grant execute on function public.order_claim(uuid, uuid) to authenticated;

-- Read-only helpers the order UI uses to decide which actions to offer.
grant execute on function public.order_actor_role(uuid) to authenticated;
grant execute on function public.order_role_may(text, public.order_state, public.order_state) to authenticated;
grant execute on function public.allowed_transitions(public.order_state) to authenticated;
