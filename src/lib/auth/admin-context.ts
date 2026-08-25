import "server-only";

import type { Seat } from "@/lib/auth/can";
import { createClient, getSessionProfile } from "@/lib/supabase/server";
import type { ExchangeOffice, Impersonation } from "@/lib/supabase/types";

export type AdminContext = {
  userId: string;
  /**
   * Who is signed in, for the console's top bar.
   *
   * An administrator who also holds an office seat can be in either panel, and
   * "whose powers am I using right now" is the question behind most mistakes in
   * a tool that can move other people's money. The session already carries the
   * profile; not passing it through meant the console could not say.
   */
  fullName: string | null;
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
  const { data: row } = await supabase.rpc("active_impersonation");

  // A SQL function returning a composite hands back a row of nulls rather than
  // null when it matches nothing, and an object of nulls is perfectly truthy —
  // which rendered the "you are acting as an office" banner over an admin who
  // was not. The id is the honest test.
  const impersonation = row && row.id ? row : null;

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
    // The Persian name first: this console is worked in Persian, and a staff
    // member who filled in only the Latin field should still be named rather
    // than left blank.
    fullName: session.profile?.full_name_fa || session.profile?.full_name_latin || null,
    seats: session.memberships as Seat[],
    impersonation: impersonation ?? null,
    impersonatedOffice,
  };
}
