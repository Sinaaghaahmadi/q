import "server-only";

import type { Seat } from "@/lib/auth/can";
import { createClient, getSessionProfile } from "@/lib/supabase/server";
import type { ExchangeOffice, Impersonation } from "@/lib/supabase/types";

export type AdminContext = {
  userId: string;
  seats: Seat[];
  impersonation: Impersonation | null;
  impersonatedOffice: Pick<ExchangeOffice, "id" | "legal_name_fa" | "legal_name_en"> | null;
};

/**
 * What every `/admin` screen needs before it can render: who is asking, what
 * they hold, and whether they are currently standing in for an office.
 * Returns null when nobody is signed in — the page redirects to sign-in.
 */
export async function getAdminContext(): Promise<AdminContext | null> {
  const session = await getSessionProfile();
  if (!session?.user) return null;

  const supabase = await createClient();
  const { data: impersonation } = await supabase.rpc("active_impersonation");

  let impersonatedOffice: AdminContext["impersonatedOffice"] = null;
  if (impersonation) {
    const { data } = await supabase
      .from("exchange_offices")
      .select("id, legal_name_fa, legal_name_en")
      .eq("id", impersonation.office_id)
      .maybeSingle();
    impersonatedOffice = data ?? null;
  }

  return {
    userId: session.user.id,
    seats: session.memberships as Seat[],
    impersonation: impersonation ?? null,
    impersonatedOffice,
  };
}
