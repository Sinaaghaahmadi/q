-- 0008 — Server-side OTP rate limiting + reference seed data.

-- ── OTP rate limiting as a database function (§6, §15) ──────────────────────
-- Runs SECURITY DEFINER so a signed-out caller can be throttled without the
-- app ever holding a service-role key. It records the attempt and returns the
-- verdict in one round trip, so the check cannot be skipped by the client.
--
-- Limits (§6: "rate-limited, 6-digit, 2-minute expiry, 5 attempts"):
--   per phone : 3 sends / 10 minutes, 6 sends / hour
--   per IP    : 20 sends / hour
create or replace function public.otp_rate_check(p_phone text, p_ip text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_ip inet := nullif(p_ip, '')::inet;
  v_recent int;
  v_hourly int;
  v_ip_hourly int;
  v_retry_after int := 0;
begin
  select count(*) into v_recent
    from public.otp_attempts
    where phone = p_phone and kind = 'send' and created_at > now() - interval '10 minutes';

  select count(*) into v_hourly
    from public.otp_attempts
    where phone = p_phone and kind = 'send' and created_at > now() - interval '1 hour';

  if v_ip is not null then
    select count(*) into v_ip_hourly
      from public.otp_attempts
      where ip = v_ip and kind = 'send' and created_at > now() - interval '1 hour';
  else
    v_ip_hourly := 0;
  end if;

  if v_recent >= 3 then
    select greatest(1, ceil(extract(epoch from (min(created_at) + interval '10 minutes' - now())) / 60))
      into v_retry_after
      from public.otp_attempts
      where phone = p_phone and kind = 'send' and created_at > now() - interval '10 minutes';
    return jsonb_build_object('allowed', false, 'reason', 'too_many_recent', 'retry_after_minutes', v_retry_after);
  end if;

  if v_hourly >= 6 or v_ip_hourly >= 20 then
    return jsonb_build_object('allowed', false, 'reason', 'hourly_cap', 'retry_after_minutes', 60);
  end if;

  insert into public.otp_attempts (phone, ip, kind) values (p_phone, v_ip, 'send');
  return jsonb_build_object('allowed', true, 'remaining', 3 - v_recent - 1);
end $$;

revoke execute on function public.otp_rate_check(text, text) from public;
grant execute on function public.otp_rate_check(text, text) to anon, authenticated;

-- ── Reference data ──────────────────────────────────────────────────────────
insert into public.rate_sources (name, kind, config, active) values
  ('tgju', 'tgju', '{"live":"https://call1.tgju.org/ajax.json","history":"https://api.tgju.org/v1/market/indicator/summary-table-data"}'::jsonb, true),
  ('frankfurter', 'frankfurter', '{"endpoint":"https://api.frankfurter.dev/v1/latest","role":"cross-check"}'::jsonb, true),
  ('demo', 'demo', '{"note":"deterministic seeded fallback"}'::jsonb, true)
on conflict (name) do nothing;

insert into public.feature_flags (key, description, enabled) values
  ('auth.otp_sms', 'SMS one-time-code sign-in', true),
  ('kyc.wizard', 'Customer KYC wizard', true),
  ('kyc.ocr', 'MRZ / OCR pre-fill on document upload', false),
  ('orders.submit', 'Customers can submit real transfer orders (Phase 3)', false),
  ('p2p.board', 'Peer-to-peer offer board (Phase 6)', false),
  ('office.panel', 'Exchange-office panel (Phase 3)', false)
on conflict (key) do nothing;

insert into public.settings (key, value) values
  ('business_calendar.ir', '{"weekend":["friday"],"half_days":["thursday"],"note":"Sat-Wed full, Thu half, Fri closed"}'::jsonb),
  ('sla.transfer', '{"target_business_days":1,"hard_business_days":3,"nudge_at_pct":60,"escalate_at_pct":85}'::jsonb),
  ('pricing.spread_bps', '{"platform_floor":20,"corridor_default":45,"office_markup":25}'::jsonb),
  ('pricing.fees', '{"platform":{"pct":0.25,"min_toman":150000},"office":{"pct":0.15,"min_toman":100000}}'::jsonb),
  ('rates.guardrail', '{"max_deviation_pct":3,"stale_seconds":180}'::jsonb)
on conflict (key) do nothing;

-- Solar-fixed Iranian national holidays. Lunar (religious) holidays shift each
-- year and are loaded per-year by an admin — seeding guessed dates into an SLA
-- engine would be worse than leaving them out.
insert into public.business_calendar (country, date, is_holiday, name) values
  ('IR', '2027-03-21', true, 'نوروز'),
  ('IR', '2027-03-22', true, 'نوروز'),
  ('IR', '2027-03-23', true, 'نوروز'),
  ('IR', '2027-03-24', true, 'نوروز'),
  ('IR', '2027-04-01', true, 'روز جمهوری اسلامی'),
  ('IR', '2027-04-02', true, 'سیزده به در'),
  ('IR', '2027-02-11', true, 'پیروزی انقلاب'),
  ('IR', '2027-03-20', true, 'ملی شدن صنعت نفت')
on conflict (country, date) do nothing;
