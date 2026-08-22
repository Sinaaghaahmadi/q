-- pgTAP tests (§15, §19). Run with `supabase test db` against a local stack.
-- Each block asserts the negative space: what a role must NOT be able to see or
-- do, and what the database refuses even when the caller is an administrator.

begin;
select plan(23);

-- ── Policies and RLS ────────────────────────────────────────────────────────
select policies_are(
  'public', 'orders',
  array['orders_visibility', 'orders_insert_draft', 'orders_matching_pool', 'orders_update_own_draft'],
  'orders exposes exactly the expected policies'
);

select ok(row_security_active('public.orders'), 'RLS is active on orders');
select ok(row_security_active('public.kyc_documents'), 'RLS is active on kyc_documents');
select ok(row_security_active('public.ledger_entries'), 'RLS is active on ledger_entries');
select ok(row_security_active('public.impersonations'), 'RLS is active on impersonations');

-- ── Nothing is edited, nothing is deleted (§0.7) ────────────────────────────
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
select throws_ok(
  $$update public.audit_log set reason = 'tamper' where false$$,
  null, null,
  'audit_log rejects updates'
);
-- 0014's forbid_delete triggers. The FOR ALL policies that let an administrator
-- configure an office would otherwise have let one erase its history too.
select throws_ok(
  $$delete from public.exchange_offices where false$$,
  null, null,
  'exchange_offices rejects deletes'
);
select throws_ok(
  $$delete from public.orders where false$$,
  null, null,
  'orders rejects deletes'
);
select throws_ok(
  $$delete from public.impersonations where false$$,
  null, null,
  'impersonations rejects deletes'
);

-- ── The API surface (§15) ───────────────────────────────────────────────────
-- `revoke ... from anon, authenticated` does not remove the PUBLIC grant
-- Postgres creates with every function, so this asserts the effective privilege
-- rather than the ACL text — the distinction that made 0007's hardening a no-op
-- until 0011 fixed it, and the reason 0014 re-runs the sweep after adding to
-- the schema.
select is_empty(
  $$select p.proname
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('assert_transition','post_order_funding','post_order_release',
                         'post_order_refund','ledger_account','handle_new_user',
                         'sync_profile_phone','gen_public_ref','gen_referral_code',
                         'set_order_public_ref','set_updated_at','forbid_mutation',
                         'forbid_delete','assert_txn_balanced','rls_auto_enable',
                         'audit_event','audit_row','actor_role_label')
       and (has_function_privilege('anon', p.oid, 'EXECUTE')
         or has_function_privilege('authenticated', p.oid, 'EXECUTE'))$$,
  'no privileged function is executable by anon or authenticated'
);

-- The administrator's entry points are for signed-in callers only; anon holds
-- nothing that can provision, configure, impersonate or force.
select is_empty(
  $$select p.proname
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('admin_create_office','admin_set_office_status',
                         'admin_set_office_member','admin_create_order_on_behalf',
                         'order_force_transition','impersonation_start','impersonation_end')
       and has_function_privilege('anon', p.oid, 'EXECUTE')$$,
  'no administrative function is executable by anon'
);

-- ── The state machine ───────────────────────────────────────────────────────
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

-- The set with no way out. `lib/orders/flow.ts` mirrors this list as TERMINAL
-- and `order_force_transition` refuses to depart it, so a state added to one
-- side and not the others is a drift this catches.
select set_eq(
  $$select s::text from unnest(enum_range(null::public.order_state)) s
     where cardinality(public.allowed_transitions(s)) = 0$$,
  array['completed','cancelled','refunded','expired','sla_breached'],
  'exactly five states are terminal'
);

-- Directionality (§8.1): the Toman leg releases only once the recipient has
-- confirmed, and nothing walks back from a funded state to an unfunded one.
select set_eq(
  $$select s::text from unnest(enum_range(null::public.order_state)) s
     where 'irt_released' = any (public.allowed_transitions(s))$$,
  array['recipient_confirmed'],
  'only a confirmed receipt releases the Toman leg'
);

-- ── The office template (§16.2) ─────────────────────────────────────────────
select is_empty(
  $$select r->>'corridor'
      from jsonb_array_elements(public.office_defaults()->'rate_config') r
     where r->>'corridor' is null or (r->>'spread_bps')::int is null$$,
  'every corridor in the office template carries a spread'
);

-- ── A policy that compares an alias to itself (§15) ─────────────────────────
-- 0005 wrote `where p.conversation_id = id` inside a subquery over
-- `conversation_participants`, which has its own `id`. Postgres bound the
-- unqualified name to the *inner* table and stored `p.conversation_id = p.id` —
-- a foreign key compared to its own primary key, false for every row. The
-- policy silently reduced to `is_platform_staff()` and every conversation was
-- invisible to the people in it, which nothing noticed until Phase 5 gave them
-- a reader. Self-comparison is never what a policy means.
select is_empty(
  $$select c.relname || '.' || p.polname
      from pg_policy p join pg_class c on c.oid = p.polrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and (coalesce(pg_get_expr(p.polqual, p.polrelid), '') || ' ' ||
            coalesce(pg_get_expr(p.polwithcheck, p.polrelid), ''))
           ~ '\(([a-z_]+)\.([a-z_]+) = \1\.([a-z_]+)\)'$$,
  'no policy compares a table alias to itself'
);

-- ── Conversations (§10) ─────────────────────────────────────────────────────
select ok(row_security_active('public.conversations'), 'RLS is active on conversations');

-- ── P2P (§9) ────────────────────────────────────────────────────────────────
select ok(row_security_active('public.p2p_offers'), 'RLS is active on p2p_offers');
select ok(row_security_active('public.p2p_trades'), 'RLS is active on p2p_trades');

-- Publishing and taking are functions, so nothing writes these tables directly.
-- A stray INSERT policy would be a way past the identity check, the corridor
-- rule and every limit in §9 at once.
select is_empty(
  $$select c.relname || '.' || p.polname
      from pg_policy p join pg_class c on c.oid = p.polrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname in ('p2p_offers','p2p_trades','conversations','conversation_participants')
       and p.polcmd in ('a', '*')$$,
  'no client-writable INSERT policy on the offer, trade or conversation tables'
);

-- Every currency the client catalog knows has a scale in the database, or
-- `convert_minor` would raise on a corridor the board happily offers.
select is_empty(
  $$select unnest(array['IRT','USD','EUR','GBP','AED','TRY','IQD','AZN','AMD','GEL',
                        'RUB','AFN','PKR','TMT','OMR','KWD','QAR','SAR','CAD','CNY'])
    except select code from public.currencies$$,
  'every catalog currency has a scale'
);

select * from finish();
rollback;
