-- Seeded demo mode (§17.21)
--
-- Produces enough of a platform that every screen can be reviewed with
-- real-looking data: two exchange offices (one live, one still a draft), a
-- compliance reviewer, three verified customers with destination accounts, and
-- orders sitting at states across the whole machine — including one refunded
-- through the administrator's override, so the compensating entries §16.4 asks
-- for are visible in the ledger rather than only described.
--
-- It doubles as the Phase-4 acceptance run: every office is provisioned through
-- `admin_create_office` and every order moves through `order_advance`,
-- `order_claim` or `order_force_transition`, each executed as the role that
-- would really be pressing the button, with `set local role authenticated` so
-- RLS is in force throughout. A clean run means the panels work — not merely
-- that the tables accept inserts.
--
-- Idempotent by the presence of the first office. Fixed UUIDs keep links into
-- the demo stable across runs. Every person, licence and account below is
-- fictional.
--
--   psql "$DATABASE_URL" -f supabase/seed/demo.sql

do $$
declare
  v_admin      uuid := '00000000-0000-4000-8000-00000000ad01';
  v_compliance uuid := '00000000-0000-4000-8000-00000000c001';
  v_operator   uuid := '00000000-0000-4000-8000-0000000000f1';
  v_c1         uuid := '00000000-0000-4000-8000-000000000c01';
  v_c2         uuid := '00000000-0000-4000-8000-000000000c02';
  v_c3         uuid := '00000000-0000-4000-8000-000000000c03';

  v_office     uuid;
  v_office2    uuid;
  v_order      uuid;
  v_spec       record;
  v_state      public.order_state;
  v_step       public.order_state;
  -- The happy path in order. The seed walks it until it reaches each order's
  -- target state, so one list describes every order's history.
  v_path       public.order_state[] := array[
    'office_review','accepted','awaiting_irt_funding','irt_funded',
    'foreign_leg_pending','foreign_leg_sent','recipient_confirmed',
    'irt_released','completed']::public.order_state[];
begin
  if exists (select 1 from public.exchange_offices where slug = 'asa-tehran') then
    raise notice 'demo data already present; nothing to do';
    return;
  end if;

  -- ── People ────────────────────────────────────────────────────────────────
  -- The token columns must be '' and never NULL. GoTrue scans them into Go
  -- strings, so a single NULL makes *every* auth request fail with "Database
  -- error querying schema" — not just this user's. Writing `auth.users`
  -- directly is the only way to seed without a service-role key, and this is
  -- the price of it.
  insert into auth.users (
    instance_id, id, aud, role, email, phone, encrypted_password,
    email_confirmed_at, phone_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change, email_change_token_new,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token,
    created_at, updated_at
  )
  select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
         u.email, u.phone,
         -- Staff sign in with a password; customers never do (§ /api/auth/password).
         case when u.staff then crypt('AsaDemo!1404', gen_salt('bf')) else '' end,
         now(), now(),
         '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
         '', '', '', '', '', '', '', '',
         now(), now()
  from (values
    (v_admin,      'admin@asaex.demo',      '+989120000001', true),
    (v_compliance, 'compliance@asaex.demo', '+989120000002', true),
    (v_operator,   'operator@asaex.demo',   '+989120000003', true),
    (v_c1,         'sara@asaex.demo',       '+989120000101', false),
    (v_c2,         'omid@asaex.demo',       '+989120000102', false),
    (v_c3,         'nadia@asaex.demo',      '+989120000103', false)
  ) as u(id, email, phone, staff)
  on conflict (id) do nothing;

  update public.profiles p set
    full_name_fa = v.fa, full_name_latin = v.en, kyc_status = 'approved', locale = v.loc
  from (values
    (v_admin,      'مدیر پلتفرم',   'Platform Admin',  'fa'),
    (v_compliance, 'ناظر انطباق',   'Compliance Lead', 'fa'),
    (v_operator,   'اپراتور صرافی', 'Office Operator', 'fa'),
    (v_c1,         'سارا کریمی',    'Sara Karimi',     'fa'),
    (v_c2,         'امید رضایی',    'Omid Rezaei',     'fa'),
    (v_c3,         'نادیا حسینی',   'Nadia Hosseini',  'en')
  ) as v(id, fa, en, loc)
  where p.id = v.id;

  insert into public.memberships (user_id, role, scope_type)
  values
    (v_admin, 'platform_admin', 'platform'),
    (v_admin, 'platform_superadmin', 'platform'),
    (v_compliance, 'platform_compliance', 'platform')
  on conflict do nothing;

  -- ── Provisioning, as the administrator (§16.1) ────────────────────────────
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  v_office := public.admin_create_office(jsonb_build_object(
    'slug', 'asa-tehran',
    'legal_name_fa', 'صرافی آسا تهران',
    'legal_name_en', 'Asa Exchange Tehran',
    'license_no', 'IR-CB-114872',
    'city', 'تهران',
    'reason', 'launch partner for the USD and EUR corridors',
    'contact', jsonb_build_object('phone', '+982188001122', 'email', 'tehran@asaex.demo'),
    'accounts', jsonb_build_array(
      jsonb_build_object('currency','IRT','kind','card','label','بانک ملی','is_public',true,
        'details', jsonb_build_object('number','6037991122334455','holder','صرافی آسا تهران')),
      jsonb_build_object('currency','IRT','kind','iban','label','شبا ملت','is_public',true,
        'details', jsonb_build_object('number','IR820170000000123456789012')),
      jsonb_build_object('currency','USD','kind','swift','label','Correspondent USD','is_public',false,
        'details', jsonb_build_object('number','AE070331234567890123456','swift','EBILAEAD')))
  ));
  perform public.admin_set_office_status(
    v_office, 'active', 'launch partner activated after licence check');

  -- A second office left in draft, so the directory shows both states and the
  -- template diff on /admin/exchanges has something to show.
  v_office2 := public.admin_create_office(jsonb_build_object(
    'slug', 'asa-mashhad',
    'legal_name_fa', 'صرافی آسا مشهد',
    'legal_name_en', 'Asa Exchange Mashhad',
    'license_no', 'IR-CB-220913',
    'city', 'مشهد',
    'reason', 'onboarding the second corridor partner',
    'rate_config', jsonb_build_array(
      jsonb_build_object('corridor','AED-IRT','spread_bps',95),
      jsonb_build_object('corridor','TRY-IRT','spread_bps',105))
  ));

  execute 'reset role';
  insert into public.memberships (user_id, role, scope_type, scope_id, created_by)
  select v_operator, r, 'office', v_office, v_admin
    from unnest(array['office_owner','office_operator','office_finance']::public.app_role[]) r
  on conflict do nothing;

  -- ── Destination accounts ──────────────────────────────────────────────────
  insert into public.beneficiary_accounts (
    id, user_id, nickname, currency, country, kind, details, holder_name, verification_state
  ) values
    ('00000000-0000-4000-8000-0000000000a1', v_c1, 'حساب دانشگاه', 'EUR', 'DE', 'iban',
     jsonb_build_object('iban','DE89370400440532013000'), 'Sara Karimi', 'verified'),
    ('00000000-0000-4000-8000-0000000000a2', v_c2, 'حساب برادرم', 'USD', 'AE', 'iban',
     jsonb_build_object('iban','AE070331234567890123456'), 'Omid Rezaei', 'verified'),
    ('00000000-0000-4000-8000-0000000000a3', v_c3, 'Family account', 'TRY', 'TR', 'iban',
     jsonb_build_object('iban','TR330006100519786457841326'), 'Nadia Hosseini', 'verified')
  on conflict (id) do nothing;

  -- ── Orders, each driven by the party who would really drive it ────────────
  for v_spec in
    select * from (values
      -- customer, destination, corridor, send, send minor, receive minor, rate, purpose, stop at
      (v_c1, '00000000-0000-4000-8000-0000000000a1'::uuid, 'EUR-IRT', 'EUR',
        250000::bigint, 51150000::bigint, 204600::numeric, 'tuition', 'completed'),
      (v_c2, '00000000-0000-4000-8000-0000000000a2'::uuid, 'USD-IRT', 'USD',
        120000::bigint, 227280000::bigint, 189400::numeric, 'family_support', 'foreign_leg_sent'),
      (v_c3, '00000000-0000-4000-8000-0000000000a3'::uuid, 'TRY-IRT', 'TRY',
        1500000::bigint, 82500000::bigint, 5500::numeric, 'family_support', 'awaiting_irt_funding'),
      (v_c1, '00000000-0000-4000-8000-0000000000a1'::uuid, 'EUR-IRT', 'EUR',
        90000::bigint, 18414000::bigint, 204600::numeric, 'medical', 'matching'),
      (v_c2, '00000000-0000-4000-8000-0000000000a2'::uuid, 'USD-IRT', 'USD',
        40000::bigint, 75760000::bigint, 189400::numeric, 'business', 'irt_funded')
    ) as s(customer, dest, corridor, ccy, send_minor, recv_minor, rate, purpose, stop_at)
  loop
    -- The customer writes the draft and submits it. `order_advance` routes
    -- submitted → matching itself, so submission lands in the pool.
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_spec.customer, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';

    insert into public.orders (
      customer_id, corridor, send_currency, send_amount_minor,
      receive_currency, receive_amount_minor, locked_rate, rate_locked_at, rate_expires_at,
      platform_fee_minor, office_fee_minor, destination_account_id, purpose_of_transfer,
      sla_target_at, due_at, state
    ) values (
      v_spec.customer, v_spec.corridor, v_spec.ccy, v_spec.send_minor,
      'IRT', v_spec.recv_minor, v_spec.rate, now(), now() + interval '15 minutes',
      (v_spec.recv_minor * 25) / 10000,          -- 0.25% platform fee
      (v_spec.recv_minor * 15) / 10000,          -- 0.15% office fee
      v_spec.dest, v_spec.purpose,
      now() + interval '1 day', now() + interval '3 days', 'draft'
    ) returning id into v_order;

    v_state := public.order_advance(v_order, 'submitted', null);
    execute 'reset role';

    if v_spec.stop_at <> 'matching' then
      -- From here the office drives, except for the one step only the recipient
      -- can take (§8.1): confirming the money arrived.
      foreach v_step in array v_path loop
        exit when v_state = v_spec.stop_at::public.order_state;

        if v_step = 'recipient_confirmed' then
          perform set_config('request.jwt.claims',
            json_build_object('sub', v_spec.customer, 'role', 'authenticated')::text, true);
        else
          perform set_config('request.jwt.claims',
            json_build_object('sub', v_operator, 'role', 'authenticated')::text, true);
        end if;
        execute 'set local role authenticated';

        if v_step = 'office_review' then
          v_state := public.order_claim(v_order, v_office);
        else
          v_state := public.order_advance(v_order, v_step, null);
        end if;

        execute 'reset role';
      end loop;
    end if;

    -- The last one is funded and then refunded by the administrator, so the
    -- ledger carries a reversal to look at rather than only a happy path.
    if v_spec.stop_at = 'irt_funded' then
      perform set_config('request.jwt.claims',
        json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
      execute 'set local role authenticated';
      perform public.order_force_transition(v_order, 'refunded',
        'beneficiary bank rejected the transfer; funds returned to the customer');
      execute 'reset role';
    end if;
  end loop;

  raise notice 'demo seeded: % offices, % orders, % ledger entries',
    (select count(*) from public.exchange_offices),
    (select count(*) from public.orders),
    (select count(*) from public.ledger_entries);
end $$;

-- ── Conversations (§10) ─────────────────────────────────────────────────────
-- A negotiate-then-transact exchange on the live order, an internal note the
-- customer cannot see, a message that trips the off-platform flag, and one
-- thread in each of the three support queues — so /admin/support has all three
-- populated rather than two empty tabs.

do $$
declare
  v_op   uuid := '00000000-0000-4000-8000-0000000000f1';
  v_c1   uuid := '00000000-0000-4000-8000-000000000c01';
  v_c2   uuid := '00000000-0000-4000-8000-000000000c02';
  v_c3   uuid := '00000000-0000-4000-8000-000000000c03';
  v_admin uuid := '00000000-0000-4000-8000-00000000ad01';
  v_ord  uuid;
  v_conv uuid;
  v_sup  uuid;
  v_offer uuid;
  v_trade uuid;
begin
  if exists (select 1 from public.conversations where kind = 'order') then
    raise notice 'demo conversations already present; nothing to do';
    return;
  end if;

  select id into v_ord from public.orders where state = 'foreign_leg_sent' limit 1;
  if v_ord is null then return; end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_c2, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_conv := public.conversation_for_order(v_ord);
  perform public.message_send(v_conv, 'سلام. حواله ارزی امروز ارسال شد؟ گیرنده پرسیده.');
  execute 'reset role';

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_op, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.message_send(v_conv,
    'سلام. بله، سوئیفت امروز صبح ارسال شد. معمولاً یک روز کاری تا نشستن در حساب گیرنده طول می‌کشد.');
  perform public.message_send(v_conv,
    'بانک کارگزار امروز کند است — اگر تا فردا ننشست پیگیری شود.', true);
  execute 'reset role';

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_c2, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  -- Trips `off_platform` and `contact`, and is left visible on purpose: the
  -- flag is a signal for compliance, never a block on the conversation.
  perform public.message_send(v_conv,
    'اگر دیر شد می‌شود کارت به کارت مستقیم تسویه کنیم؟ تلگرام من 09121234567');
  v_sup := public.conversation_for_support();
  perform public.message_send(v_sup,
    'سلام، رسید واریز تومانی من ثبت شده اما وضعیت سفارش عوض نشده.');
  execute 'reset role';

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_op, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.message_send(public.conversation_for_support(),
    'درخواست افزایش سقف روزانه کریدور یورو داریم. مدارک آماده است.');
  execute 'reset role';

  -- The segment is derived, never chosen, so a P2P trader is only in the P2P
  -- queue if they actually have an offer. Give Nadia one *before* she writes,
  -- rather than reclassifying her thread afterwards — the second would be the
  -- platform lying to its own queue. It goes through `p2p_offer_publish` like
  -- any other offer, so the seed exercises the real path.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_c3, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.p2p_offer_publish(jsonb_build_object(
    'have_currency', 'TRY', 'want_currency', 'IRT',
    -- 30,000 TRY at 5,500 is 165M Toman, inside the tier-0 ceiling of 200M.
    'amount_minor', 3000000, 'min_slice_minor', 100000,
    'rate_mode', 'fixed', 'rate_value', 5500,
    'terms', 'Istanbul, cash pickup, weekdays'));
  perform public.message_send(public.conversation_for_support(),
    'How do I list an offer on the P2P board?');
  execute 'reset role';

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.support_set_state(v_sup, null, true);
  execute 'reset role';

  -- Sara offers euros; Omid takes a slice, which routes a real order to the
  -- escrow office and gives /p2p/trades/[id] something to show.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_c1, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_offer := public.p2p_offer_publish(jsonb_build_object(
    'have_currency', 'EUR', 'want_currency', 'IRT',
    'amount_minor', 80000, 'min_slice_minor', 10000,
    'rate_mode', 'fixed', 'rate_value', 204600,
    'terms', 'Frankfurt SEPA, same business day'));
  execute 'reset role';

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_c2, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_trade := public.p2p_trade_take(v_offer, 40000, 204600);
  perform public.message_send(public.conversation_for_trade(v_trade),
    'سلام. تومان را همین امروز واریز می‌کنم.');
  execute 'reset role';

  raise notice 'demo conversations seeded: % threads, % messages',
    (select count(*) from public.conversations),
    (select count(*) from public.messages);
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Editorial content and notification copy.
--
-- /admin/content edits both of these tables, and both shipped empty: the page
-- opened onto two blank tabs, so nothing about the editor could be judged — not
-- the Persian/English pairing, not publish-and-unpublish, not the variable
-- schema on a template. Seeding them is what makes the screen mean something.
--
-- Idempotent on the natural keys, so re-running the seed neither duplicates a
-- row nor overwrites an edit somebody made through the panel.
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.cms_content (key, locale, type, title, body, published_at) values
  ('faq-how-long', 'fa', 'faq', 'انتقال چقدر طول می‌کشد؟',
   'بیشتر انتقال‌ها در همان روز کاری انجام می‌شود. پس از اینکه صرافی مبلغ را ارسال کرد، وضعیت سفارش شما به «ارسال شد» تغییر می‌کند و گیرنده معمولاً ظرف چند ساعت مبلغ را دریافت می‌کند.',
   now() - interval '20 days'),
  ('faq-how-long', 'en', 'faq', 'How long does a transfer take?',
   'Most transfers complete within the same business day. Once the exchange office sends the money your order moves to “sent”, and the recipient usually has the funds within a few hours.',
   now() - interval '20 days'),

  ('faq-rate-lock', 'fa', 'faq', 'نرخ چه زمانی قفل می‌شود؟',
   'نرخ در لحظهٔ ثبت سفارش قفل می‌شود و تا زمان انقضای اعلام‌شده روی همان سفارش ثابت می‌ماند. اگر سفارش منقضی شود، نرخ روز دوباره محاسبه می‌شود.',
   now() - interval '18 days'),
  ('faq-rate-lock', 'en', 'faq', 'When is the rate locked?',
   'The rate is locked the moment you place the order and holds for that order until the stated expiry. If an order expires, the rate is recalculated at the current price.',
   now() - interval '18 days'),

  ('faq-documents', 'fa', 'faq', 'چه مدارکی لازم است؟',
   'برای مبالغ کوچک، شمارهٔ تماس تأییدشده کافی است. با بالا رفتن سقف انتقال، کارت ملی یا گذرنامه و یک عکس زنده لازم می‌شود. مدارک شما رمزگذاری‌شده نگهداری و هرگز با گیرنده به اشتراک گذاشته نمی‌شود.',
   now() - interval '15 days'),
  ('faq-documents', 'en', 'faq', 'What documents do I need?',
   'For small amounts a verified phone number is enough. As your limits rise we ask for a national ID or passport and a liveness photo. Documents are stored encrypted and are never shared with the recipient.',
   now() - interval '15 days'),

  ('faq-fees', 'fa', 'faq', 'کارمزد چگونه محاسبه می‌شود؟',
   'کارمزد پیش از تأیید، به صورت کامل و جداگانه نمایش داده می‌شود: نرخ تبدیل، کارمزد صرافی و هزینهٔ انتقال. مبلغی که گیرنده دریافت می‌کند همان عددی است که در پیش‌فاکتور دیده‌اید.',
   now() - interval '12 days'),
  ('faq-fees', 'en', 'faq', 'How are fees calculated?',
   'Every fee is shown in full before you confirm: the conversion rate, the office margin, and the transfer cost. The amount the recipient receives is the number you saw on the quote.',
   now() - interval '12 days'),

  ('announce-hours', 'fa', 'announcement', 'ساعات کاری در ایام تعطیل',
   'در روزهای تعطیل رسمی، سفارش‌ها ثبت می‌شوند اما تسویهٔ ریالی در اولین روز کاری انجام خواهد شد.',
   now() - interval '3 days'),
  ('announce-hours', 'en', 'announcement', 'Holiday opening hours',
   'On public holidays orders are still accepted, but rial settlement happens on the next business day.',
   now() - interval '3 days'),

  -- Left unpublished on purpose: the editor needs one draft to show that
  -- publish/unpublish is a real control and not a decoration.
  ('announce-new-corridor', 'fa', 'announcement', 'کریدور جدید: امارات',
   'به‌زودی انتقال به درهم امارات از طریق صرافی‌های همکار در دبی فعال می‌شود.', null),
  ('announce-new-corridor', 'en', 'announcement', 'New corridor: UAE',
   'Transfers to UAE dirham through partner offices in Dubai are opening soon.', null)
on conflict (key, locale) do nothing;

insert into public.notification_templates (key, locale, channel, subject, body, variables) values
  ('order_matched', 'fa', 'sms', null,
   'آساایکس: سفارش {{ref}} به صرافی {{office}} سپرده شد. پیگیری: {{link}}',
   '["ref","office","link"]'::jsonb),
  ('order_matched', 'en', 'sms', null,
   'Asaex: order {{ref}} has been assigned to {{office}}. Track it: {{link}}',
   '["ref","office","link"]'::jsonb),

  ('funding_needed', 'fa', 'sms', null,
   'آساایکس: برای سفارش {{ref}} مبلغ {{amount}} تومان را به حساب اعلام‌شده واریز کنید.',
   '["ref","amount"]'::jsonb),
  ('funding_needed', 'en', 'sms', null,
   'Asaex: please transfer {{amount}} IRT for order {{ref}} to the account shown in the app.',
   '["ref","amount"]'::jsonb),

  ('leg_sent', 'fa', 'sms', null,
   'آساایکس: مبلغ {{amount}} {{currency}} برای سفارش {{ref}} ارسال شد. پس از دریافت، در برنامه تأیید کنید.',
   '["ref","amount","currency"]'::jsonb),
  ('leg_sent', 'en', 'sms', null,
   'Asaex: {{amount}} {{currency}} has been sent for order {{ref}}. Confirm receipt in the app.',
   '["ref","amount","currency"]'::jsonb),

  ('order_completed', 'fa', 'email', 'سفارش {{ref}} تکمیل شد',
   'سلام {{name}}،

سفارش {{ref}} با موفقیت تکمیل شد. گیرنده مبلغ {{amount}} {{currency}} را دریافت کرد.

رسید کامل در حساب کاربری شما در دسترس است: {{link}}

آساایکس',
   '["name","ref","amount","currency","link"]'::jsonb),
  ('order_completed', 'en', 'email', 'Order {{ref}} is complete',
   'Hello {{name}},

Order {{ref}} has completed. The recipient received {{amount}} {{currency}}.

Your full receipt is in your account: {{link}}

Asaex',
   '["name","ref","amount","currency","link"]'::jsonb),

  ('kyc_approved', 'fa', 'inapp', null,
   'احراز هویت شما تأیید شد. سقف انتقال شما به سطح {{tier}} افزایش یافت.',
   '["tier"]'::jsonb),
  ('kyc_approved', 'en', 'inapp', null,
   'Your identity check was approved. Your limits are now at the {{tier}} tier.',
   '["tier"]'::jsonb),

  ('kyc_rejected', 'fa', 'inapp', null,
   'مدارک شما تأیید نشد: {{reason}}. می‌توانید دوباره ارسال کنید.',
   '["reason"]'::jsonb),
  ('kyc_rejected', 'en', 'inapp', null,
   'Your documents were not accepted: {{reason}}. You can submit again.',
   '["reason"]'::jsonb)
on conflict (key, locale, channel) do nothing;

do $$
begin
  raise notice 'content seeded: % cms rows (% published), % notification templates',
    (select count(*) from public.cms_content),
    (select count(*) from public.cms_content where published_at is not null),
    (select count(*) from public.notification_templates);
end $$;
