-- ─────────────────────────────────────────────────────────────────────────────
-- 0020 — Room to manoeuvre on price, with a wall at the end of it
--
-- A P2P offer's price was validated as `rate > 0` and nothing else. That is
-- both too loose and too tight: too loose because a fat finger could publish
-- 1,970,000 where 197,000 was meant and nothing would stop it, and too tight in
-- spirit because there was no stated room for the thing people actually want to
-- do — shade the price to trade sooner.
--
-- So: an explicit band of ±7%, and the two directions mean different things.
--   · Selling currency (`side = 'have'`): pricing *below* the market moves it
--     faster, because a buyer sees a bargain.
--   · Buying currency (`side = 'want'`): pricing *above* the market moves it
--     faster, because a seller sees a premium.
-- Both directions get the same 7%, so neither side of the book can be squeezed
-- by a rule the other side does not face.
--
-- The reference the band is measured against comes from `rate_snapshots` when a
-- fresh one exists, and falls back to the value the client saw. The fallback is
-- honestly weaker — a client could send a reference that makes any price look
-- reasonable — but it is recorded on the row either way, so an inspection can
-- see what was claimed. When the rate poller starts writing snapshots the
-- authoritative branch takes over on its own, with no code change here.
-- ─────────────────────────────────────────────────────────────────────────────

-- A. The band, and the reference each offer was measured against ─────────────

alter table public.p2p_offers
  add column if not exists reference_rate numeric(28, 10);

comment on column public.p2p_offers.reference_rate is
  'Market mid the price was measured against at publish time. From rate_snapshots when fresh, otherwise the value the client reported (advisory, recorded for inspection).';

insert into public.settings (key, value)
values (
  'p2p_rate_band',
  jsonb_build_object(
    'bps', 700,
    'note', 'How far either side may price away from the market mid. 700 bps = 7%.'
  )
)
on conflict (key) do nothing;

-- B. Reading the band and the reference ──────────────────────────────────────

create or replace function public.p2p_rate_band_bps()
returns int
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select (value->>'bps')::int from public.settings where key = 'p2p_rate_band'), 700);
$$;

/**
 * The market mid for a pair, if the database knows one recently enough to be
 * worth trusting. Null means it does not, and the caller must fall back.
 *
 * Ten minutes is the staleness limit: long enough to survive a poller hiccup,
 * short enough that a band measured against it still means something on a
 * currency that moves as fast as the Toman.
 */
create or replace function public.p2p_market_mid(p_pair text)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select s.mid
    from public.rate_snapshots s
   where s.pair = p_pair
     and s.observed_at > now() - interval '10 minutes'
   order by s.observed_at desc
   limit 1;
$$;

-- C. Publishing an offer, now inside the band ────────────────────────────────

create or replace function public.p2p_offer_publish(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_have text := upper(btrim(coalesce(p_payload->>'have_currency', '')));
  v_want text := upper(btrim(coalesce(p_payload->>'want_currency', '')));
  v_amount bigint := (p_payload->>'amount_minor')::bigint;
  v_min bigint := nullif(p_payload->>'min_slice_minor', '')::bigint;
  v_max bigint := nullif(p_payload->>'max_slice_minor', '')::bigint;
  v_mode text := coalesce(nullif(btrim(coalesce(p_payload->>'rate_mode', '')), ''), 'fixed');
  v_rate numeric := (p_payload->>'rate_value')::numeric;
  v_client_ref numeric := nullif(p_payload->>'reference_rate', '')::numeric;
  v_terms text := nullif(btrim(coalesce(p_payload->>'terms', '')), '');
  v_side text;
  v_pair text;
  v_reference numeric;
  v_band int := public.p2p_rate_band_bps();
  v_drift numeric;
  v_offer uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  -- Same gate 0017 used. `kyc_status` is the column on `profiles`;
  -- `verification_state` belongs to `beneficiary_accounts` and is a different
  -- thing entirely.
  if (select kyc_status from public.profiles where id = auth.uid()) is distinct from 'approved' then
    raise exception 'identity must be verified before posting an offer';
  end if;

  if not exists (select 1 from public.currencies where code = v_have)
     or not exists (select 1 from public.currencies where code = v_want) then
    raise exception 'unknown currency';
  end if;
  if v_have = v_want then raise exception 'the two legs must differ'; end if;
  if v_have <> 'IRT' and v_want <> 'IRT' then
    raise exception 'one leg of an offer must be Toman';
  end if;
  if v_amount is null or v_amount <= 0 then raise exception 'amount must be positive'; end if;
  if v_mode not in ('fixed', 'market_offset') then raise exception 'unknown rate mode %', v_mode; end if;
  if v_rate is null or v_rate <= 0 then raise exception 'rate must be positive'; end if;

  -- Which way this offer leans. Selling foreign currency for Toman is 'have';
  -- wanting foreign currency for Toman is 'want'.
  v_side := case when v_want = 'IRT' then 'have' else 'want' end;
  v_pair := case when v_want = 'IRT' then v_have || '/IRT' else v_want || '/IRT' end;

  -- The band only applies to a fixed price. A market_offset offer is defined
  -- *relative* to the market already, so measuring its drift from the market
  -- would be circular.
  if v_mode = 'fixed' then
    v_reference := coalesce(public.p2p_market_mid(v_pair), v_client_ref);
    if v_reference is not null and v_reference > 0 then
      v_drift := (v_rate - v_reference) / v_reference * 10000;
      if abs(v_drift) > v_band then
        raise exception
          'price is % bps from the market mid; the limit is % bps either way',
          round(abs(v_drift)), v_band;
      end if;
    end if;
  end if;

  if public.p2p_tier_ceiling(auth.uid()) is not null
     and v_amount > public.p2p_tier_ceiling(auth.uid()) then
    raise exception 'that amount is above the ceiling for your verification tier';
  end if;

  if (select count(*) from public.p2p_offers o
       where o.user_id = auth.uid() and o.status = 'open' and o.deleted_at is null) >= 10 then
    raise exception 'you already have the maximum number of open offers';
  end if;

  if (select count(*) from public.p2p_offers o
       where o.user_id = auth.uid() and o.created_at > now() - interval '1 hour') >= 20 then
    raise exception 'too many offers in the last hour; try again later';
  end if;

  if exists (
    select 1 from public.p2p_offers o
     where o.user_id = auth.uid() and o.status = 'open' and o.deleted_at is null
       and o.have_currency = v_have and o.want_currency = v_want
  ) then
    raise exception 'you already have an open offer for that pair';
  end if;

  insert into public.p2p_offers (
    user_id, side, have_currency, want_currency, amount_minor,
    min_slice_minor, max_slice_minor, rate_mode, rate_value, reference_rate,
    terms, expires_at, status
  )
  values (
    auth.uid(), v_side, v_have, v_want, v_amount,
    v_min, v_max, v_mode, v_rate, v_reference,
    v_terms, now() + interval '7 days', 'open'
  )
  returning id into v_offer;

  return v_offer;
end;
$$;

revoke all on function public.p2p_rate_band_bps() from public;
revoke all on function public.p2p_market_mid(text) from public;
revoke all on function public.p2p_offer_publish(jsonb) from public;
grant execute on function public.p2p_rate_band_bps() to authenticated;
grant execute on function public.p2p_market_mid(text) to authenticated, anon;
grant execute on function public.p2p_offer_publish(jsonb) to authenticated;
