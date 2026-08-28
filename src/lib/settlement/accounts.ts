import type { SettlementGroup } from "@/components/settlement/settlement-view";
import { createClient } from "@/lib/supabase/server";
import type { OfficeAccount } from "@/lib/supabase/types";

/** How many offices the platform view lists before it needs a filter. */
export const OFFICES_SHOWN = 60;

/**
 * Load settlement accounts, grouped by office.
 *
 * One loader for both panels because the difference between them is RLS, not
 * SQL: an office member's select returns their own office's rows, a platform
 * staffer's returns everyone's. Passing `officeIds` narrows it further for the
 * office panel, where we already know the answer and would rather not pay for a
 * scan that policy will filter anyway.
 *
 * Retired accounts stay in the list. An office that cannot see the card it
 * retired last week has no way to tell "we took it out of use" from "it
 * vanished", and the second reading is the one that generates a support ticket.
 */
export async function loadSettlementGroups(
  locale: string,
  officeIds?: string[],
): Promise<SettlementGroup[]> {
  const supabase = await createClient();

  let accountQuery = supabase
    .from("office_accounts")
    .select("*")
    .is("deleted_at", null)
    .order("retired_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: false });
  if (officeIds && officeIds.length > 0) accountQuery = accountQuery.in("office_id", officeIds);

  let officeQuery = supabase
    .from("exchange_offices")
    .select("id, legal_name_fa, legal_name_en")
    .is("deleted_at", null)
    .order("legal_name_fa")
    .limit(OFFICES_SHOWN);
  if (officeIds && officeIds.length > 0) officeQuery = officeQuery.in("id", officeIds);

  const [{ data: accounts }, { data: offices }] = await Promise.all([accountQuery, officeQuery]);

  const rows = (accounts ?? []) as OfficeAccount[];
  return (offices ?? []).map((office) => ({
    officeId: office.id,
    officeName:
      (locale === "fa" ? office.legal_name_fa : office.legal_name_en) ?? office.legal_name_fa,
    accounts: rows.filter((a) => a.office_id === office.id),
  }));
}
