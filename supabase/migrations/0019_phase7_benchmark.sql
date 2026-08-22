-- 0019 — Phase 7: an honest cost comparison (§17.11)
--
-- §17.11 asks for "You saved X vs. the average market rate", and calls it
-- honest "because tgju gives a public benchmark". The benchmark is real; the
-- sentence needs care. tgju publishes a *mid*, and our customer rate is the mid
-- plus our spread — so measured against the mid we never save anyone anything.
-- The saving, where it exists, is against what a walk-in counter charges over
-- that same mid.
--
-- So this stores the mid at lock time and states two numbers plainly (§18): what
-- this transfer cost over the public mid, and what a counter typically charges
-- over it. The reader can subtract. That is checkable; "you saved X" with no
-- stated comparison is not, and the comparison figure lives in `settings` so it
-- can be corrected without a deploy.

alter table public.orders
  add column if not exists benchmark_rate numeric(28,10);

comment on column public.orders.benchmark_rate is
  'The tgju mid at the moment the rate was locked, kept so a completed order can state its all-in cost against a public benchmark (§17.11) without needing a historical rate feed.';

insert into public.settings (key, value) values (
  'cost_benchmark',
  jsonb_build_object(
    'counter_spread_bps', 200,
    'note', 'Typical walk-in exchange-counter spread over the tgju mid. Editable, and shown to customers as a stated comparison rather than an implied saving.'
  )
) on conflict (key) do nothing;

create or replace function public.cost_benchmark()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select value from public.settings where key = 'cost_benchmark'), '{}'::jsonb);
$$;

revoke all on function public.cost_benchmark() from public, anon, authenticated;
grant execute on function public.cost_benchmark() to anon, authenticated;
