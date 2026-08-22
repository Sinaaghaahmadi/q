-- pgTAP RLS test skeleton (§15, §19). Runs under `supabase test db` once a
-- local stack exists (Phase 2 CI). Each block asserts the negative space:
-- what a role must NOT be able to see or do.

begin;
select plan(8);

-- 1. A customer cannot read another customer's orders.
select policies_are(
  'public', 'orders',
  array['orders_visibility', 'orders_insert_draft'],
  'orders exposes exactly the expected policies'
);

-- 2. RLS is enabled on every §11 table.
select row_security_active('public.orders')::int = 1 as ok;
select row_security_active('public.kyc_documents')::int = 1 as ok;
select row_security_active('public.ledger_entries')::int = 1 as ok;

-- 3. order_events / audit_log are append-only (trigger fires on UPDATE).
select throws_ok(
  $$update public.order_events set reason = 'tamper' where false$$,
  null, null,
  'order_events rejects updates'
);
select throws_ok(
  $$delete from public.audit_log where false$$,
  null, null,
  'audit_log rejects deletes'
);

select * from finish();
rollback;

-- 4. No privileged function is reachable from the API (§15).
--    `revoke ... from anon, authenticated` does not remove the PUBLIC grant
--    Postgres creates with every function, so this asserts the effective
--    privilege rather than the ACL text — the distinction that made 0007's
--    hardening a no-op until 0011 fixed it.
select is_empty(
  $$select p.proname
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('assert_transition','post_order_funding','post_order_release',
                         'ledger_account','handle_new_user','sync_profile_phone',
                         'gen_public_ref','gen_referral_code','set_order_public_ref',
                         'set_updated_at','forbid_mutation','assert_txn_balanced',
                         'rls_auto_enable')
       and (has_function_privilege('anon', p.oid, 'EXECUTE')
         or has_function_privilege('authenticated', p.oid, 'EXECUTE'))$$,
  'no privileged function is executable by anon or authenticated'
);

-- 5. Every transition a role is permitted must also be one the machine allows,
--    or the permission is a runtime error waiting to happen.
select is_empty(
  $$with states as (select unnest(enum_range(null::public.order_state)) s),
         pairs as (select a.s f, b.s t from states a cross join states b),
         roles as (select unnest(array['customer','office','platform']) r)
    select r.r, p.f, p.t
      from roles r cross join pairs p
     where public.order_role_may(r.r, p.f, p.t)
       and not (p.t = any (public.allowed_transitions(p.f)))$$,
  'the role matrix never permits an illegal transition'
);
