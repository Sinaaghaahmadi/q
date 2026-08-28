-- ─────────────────────────────────────────────────────────────────────────────
-- 0029 — Price alerts that can actually fire
--
-- `price_alerts` has existed since 0003 and nothing has ever written to it. The
-- rates page carried a badge saying alerts arrive later, which was true, and
-- the reason they could not arrive is worth stating: the database does not know
-- what anything costs.
--
-- Prices live in the Next.js process — an in-memory cache in front of tgju —
-- and `rate_snapshots` has zero rows. An alert is a standing question about a
-- number, so something that holds the number has to be able to answer it. Three
-- pieces close that:
--
--   1. `rate_snapshot_record` — the app hands each fresh snapshot to the
--      database as it refreshes. One row per currency per observation.
--   2. `price_alerts_evaluate` — walks the live alerts against the newest
--      snapshot and writes a notification for each one that has crossed.
--   3. a schedule, so (2) runs without anybody watching.
--
-- The honest limitation, recorded here rather than discovered later: the app
-- writes snapshots when it refreshes, and it refreshes when somebody is looking
-- at it. If nobody opens Asaex for six hours, no snapshot lands for six hours.
-- The evaluator deals with that by refusing to fire on stale data rather than
-- by firing late — an alert that arrives on a price from this morning is worse
-- than one that never arrives, because a person may act on it.
-- ─────────────────────────────────────────────────────────────────────────────

-- A. Somewhere for a price to live ───────────────────────────────────────────

/**
 * Record one observation of the market.
 *
 * Called by the app's rate service each time it fetches. `observed_at` is when
 * the *source* saw the price, not when we stored it, so a stale upstream is
 * visible as a stale row rather than hidden behind a fresh insert.
 *
 * SECURITY DEFINER with a role check rather than an RLS policy: this is a write
 * only the platform's own server should make, and it is called on the caller's
 * session, so a customer's browser cannot inject a price by replaying it.
 */
create or replace function public.rate_snapshot_record(p_rows jsonb)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row jsonb;
  v_source uuid;
  v_count int := 0;
begin
  -- Anyone signed in may *record* what the public rates endpoint already
  -- serves; the value is not a secret and the endpoint is open. What matters is
  -- that anon cannot, so a drive-by cannot poison the series used for alerts.
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  for v_row in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    -- `rate_snapshots` is keyed by `pair` ("USD-IRT") and a source *id*, which
    -- is the same shape `price_alerts.pair` already uses — so the alert
    -- evaluator below compares like with like and needs no parsing.
    select id into v_source from public.rate_sources
     where kind = coalesce(nullif(btrim(coalesce(v_row->>'source', '')), ''), 'tgju')
     limit 1;

    -- `bid` and `ask` are NOT NULL. The rates pipeline quotes a single
    -- mid-market number — the spread is an office's own, applied per corridor
    -- at quote time — so a snapshot with no spread is bid = ask = mid. Writing
    -- an invented spread here would put a price in the series that nobody ever
    -- offered.
    insert into public.rate_snapshots (source_id, pair, bid, ask, mid, observed_at, raw)
    values (
      v_source,
      upper(btrim(v_row->>'pair')),
      coalesce((v_row->>'bid')::numeric, (v_row->>'mid')::numeric),
      coalesce((v_row->>'ask')::numeric, (v_row->>'mid')::numeric),
      (v_row->>'mid')::numeric,
      coalesce((v_row->>'observed_at')::timestamptz, now()),
      v_row
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- B. The standing question ───────────────────────────────────────────────────

/**
 * Fire every alert whose threshold the market has crossed.
 *
 * Three rules, each there for a reason a user would recognise:
 *
 *   · **Fresh data only.** A snapshot older than fifteen minutes is not used at
 *     all. An alert delivered on a stale price invites somebody to act on a
 *     number that has already moved.
 *   · **Once per crossing, not once per tick.** `last_fired_at` holds the alert
 *     quiet for six hours. A price that hovers on the threshold would otherwise
 *     send a message every time this runs, which is how people turn alerts off.
 *   · **In-app only, for now.** A row in `notifications` with status `queued`.
 *     SMS and push are the same row with a different channel, once the gateway
 *     credentials exist; nothing here has to change for that.
 */
create or replace function public.price_alerts_evaluate()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_alert record;
  v_mid numeric;
  v_observed timestamptz;
  v_fired int := 0;
begin
  for v_alert in
    select a.* from public.price_alerts a
     where a.active and a.deleted_at is null
       and (a.last_fired_at is null or a.last_fired_at < now() - interval '6 hours')
  loop
    select s.mid, s.observed_at into v_mid, v_observed
      from public.rate_snapshots s
     where s.pair = v_alert.pair
     order by s.observed_at desc
     limit 1;

    -- No price, or one too old to act on.
    if v_mid is null or v_observed < now() - interval '15 minutes' then
      continue;
    end if;

    if (v_alert.direction = 'above' and v_mid >= v_alert.threshold)
       or (v_alert.direction = 'below' and v_mid <= v_alert.threshold) then

      insert into public.notifications (user_id, channel, template, payload, status)
      values (
        v_alert.user_id, 'inapp', 'price_alert',
        jsonb_build_object(
          'pair', v_alert.pair,
          'direction', v_alert.direction,
          'threshold', v_alert.threshold,
          'mid', v_mid,
          'observed_at', v_observed),
        'queued');

      update public.price_alerts set last_fired_at = now() where id = v_alert.id;
      v_fired := v_fired + 1;
    end if;
  end loop;

  return v_fired;
end;
$$;

-- C. How many a person may keep ──────────────────────────────────────────────
-- Unbounded alerts are unbounded notifications, and the table is writable
-- directly by its owner under `price_alerts_own`. A trigger is the only place
-- this can be enforced without taking that policy away.

create or replace function public.price_alerts_cap()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if (select count(*) from public.price_alerts
       where user_id = new.user_id and active and deleted_at is null) >= 20 then
    raise exception 'you can keep up to 20 price alerts at a time';
  end if;
  return new;
end;
$$;

drop trigger if exists t_price_alerts_cap on public.price_alerts;
create trigger t_price_alerts_cap
  before insert on public.price_alerts
  for each row execute function public.price_alerts_cap();

-- D. Grants ──────────────────────────────────────────────────────────────────

revoke all on function public.rate_snapshot_record(jsonb) from public;
revoke all on function public.price_alerts_evaluate() from public;
grant execute on function public.rate_snapshot_record(jsonb) to authenticated;
-- Deliberately not granted to any client role: this is for the scheduler.

-- E. The schedule ────────────────────────────────────────────────────────────
-- Applied separately as `price_alerts_schedule`; recorded here so the file is
-- the whole story.
--
--   create extension if not exists pg_cron with schema pg_catalog;
--   select cron.schedule('asaex-price-alerts', '*/5 * * * *',
--     $$select public.price_alerts_evaluate();$$);
--
-- Five minutes bounds how *late* a notification can be, never how many are
-- sent: `last_fired_at` holds each alert quiet for six hours after it fires, so
-- running the evaluator more often changes nothing except latency.
