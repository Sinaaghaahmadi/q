import { Receipt, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import * as React from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminOrderTable } from "@/components/admin/order-table";
import { EmptyState } from "@/components/layout/empty-state";
import { redirect } from "@/i18n/navigation";
import { getAdminContext } from "@/lib/auth/admin-context";
import { can, isPlatformStaff } from "@/lib/auth/can";
import { TERMINAL_STATES } from "@/lib/orders/flow";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { ExchangeOffice, Order, OrderState } from "@/lib/supabase/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });
  return { title: t("orders.metaTitle") };
}

export default async function AdminOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    state?: string;
    corridor?: string;
    office?: string;
    risk?: string;
  }>;
}) {
  const { locale } = await params;
  const { state, corridor, office, risk } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  if (!isSupabaseConfigured()) {
    return (
      <EmptyState
        icon={Receipt}
        title={t("unavailableTitle")}
        description={t("unavailableBody")}
        ctaLabel={t("backHome")}
      />
    );
  }

  const ctx = await getAdminContext();
  if (!ctx) redirect({ href: "/signin?next=/admin/orders", locale });
  if (!ctx || !isPlatformStaff(ctx.seats)) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title={t("forbiddenTitle")}
        description={t("forbiddenBody")}
        ctaLabel={t("backHome")}
      />
    );
  }

  const supabase = await createClient();
  /*
   * The filters the dashboard links into.
   *
   * Every figure on the console is now a way in here — a bar in the state
   * breakdown, a corridor in the mix, an office's order count, the at-risk
   * footnote under the in-flight tile. Each of those is a question with rows
   * behind it, and a dashboard that shows the number and stops there ends the
   * investigation exactly where it got interesting.
   *
   * They stack, so "this office's disputed orders" is a link and not a
   * feature. Unknown values simply return nothing rather than raising: a
   * hand-edited URL is a typo, not an incident.
   */
  let query = supabase
    .from("orders")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);
  if (state) query = query.eq("state", state as OrderState);
  if (corridor) query = query.eq("corridor", corridor);
  // `unclaimed` is a real answer to "which office", not a missing filter: it
  // is the queue nobody has picked up, which is the one worth looking at.
  if (office) {
    query = office === "unclaimed" ? query.is("office_id", null) : query.eq("office_id", office);
  }
  if (risk) {
    // Past the deadline counts as at risk, so the window has no floor — it is
    // "less than a day left", matching the tile that links here.
    const horizon = new Date(Date.now() + 86_400_000).toISOString();
    query = query
      .not("due_at", "is", null)
      .lt("due_at", horizon)
      .not("state", "in", `(${TERMINAL_STATES.join(",")})`);
  }

  const [{ data: orders }, { data: offices }] = await Promise.all([
    query,
    supabase.from("exchange_offices").select("id, legal_name_fa, legal_name_en"),
  ]);

  return (
    <AdminShell
      seats={ctx.seats}
      impersonation={ctx.impersonation}
      office={ctx.impersonatedOffice}
      title={t("orders.title")}
      description={t("orders.subtitle")}
    >
      <AdminOrderTable
        orders={(orders ?? []) as Order[]}
        offices={
          (offices ?? []) as Pick<ExchangeOffice, "id" | "legal_name_fa" | "legal_name_en">[]
        }
        canForce={can(ctx.seats, "order.force")}
        activeState={state ?? null}
        narrowed={{
          corridor: corridor ?? null,
          office: office ?? null,
          risk: risk ? true : false,
        }}
      />
    </AdminShell>
  );
}
