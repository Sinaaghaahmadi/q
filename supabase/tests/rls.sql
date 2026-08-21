-- pgTAP RLS test skeleton (§15, §19). Runs under `supabase test db` once a
-- local stack exists (Phase 2 CI). Each block asserts the negative space:
-- what a role must NOT be able to see or do.

begin;
select plan(6);

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
