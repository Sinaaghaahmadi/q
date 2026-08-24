-- Loyalty tiers, restated against the commission that actually exists.
--
-- The tiers were written when the customer paid a platform fee quoted in basis
-- points, and they moved that figure: 25 bps at standard down to 10 at
-- platinum. There is no such fee any more. The customer pays one banded
-- commission and how it splits between the platform and the office is not a
-- fact about their transfer — so a tier that advertises a smaller platform fee
-- is advertising a benefit the price no longer contains.
--
-- It now discounts the commission itself, in percentage points off each band:
-- half a point at silver, one at gold, one and a half at platinum. Against a
-- commission between 5% and 15% that is a benefit somebody can feel, where five
-- basis points was not.
--
-- The floor is preserved in `commission.ts` rather than here: a discount is
-- applied per band and clamped at the published 5% minimum, so the fee schedule
-- stays literally true — "between 5% and 15%" — for a platinum customer as much
-- as for a new one. Setting a discount larger than ten points here would simply
-- put every band on the floor, not below it.

update public.settings
   set value = jsonb_build_array(
     jsonb_build_object('key','standard','from_irt',0,           'commission_discount_pct',0),
     jsonb_build_object('key','silver',  'from_irt',2000000000,  'commission_discount_pct',0.5),
     jsonb_build_object('key','gold',    'from_irt',10000000000, 'commission_discount_pct',1),
     jsonb_build_object('key','platinum','from_irt',50000000000, 'commission_discount_pct',1.5)
   ),
       updated_at = now()
 where key = 'customer_tiers';

create or replace function public.customer_tier(p_user uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_user uuid := coalesce(p_user, auth.uid());
  v_volume bigint;
  v_tiers jsonb := public.customer_tiers();
  v_current jsonb;
  v_next jsonb;
  t jsonb;
begin
  if v_user is null then
    return jsonb_build_object('tier', 'standard', 'commission_discount_pct', 0);
  end if;
  v_volume := public.customer_volume_irt(v_user);

  for t in select * from jsonb_array_elements(v_tiers) loop
    if v_volume >= (t->>'from_irt')::bigint then
      v_current := t;
    elsif v_next is null then
      v_next := t;
    end if;
  end loop;

  return jsonb_build_object(
    'tier', coalesce(v_current->>'key', 'standard'),
    -- Numeric rather than int: half a percentage point is a real tier.
    'commission_discount_pct',
      coalesce((v_current->>'commission_discount_pct')::numeric, 0),
    'volume_irt', v_volume,
    'next', v_next,
    'to_next_irt', case when v_next is null then null
                        else (v_next->>'from_irt')::bigint - v_volume end
  );
end $$;

revoke all on function public.customer_tier(uuid) from public, anon, authenticated;
grant execute on function public.customer_tier(uuid) to authenticated;
