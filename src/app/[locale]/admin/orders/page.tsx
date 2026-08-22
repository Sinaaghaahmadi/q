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
  searchParams: Promise<{ state?: string }>;
}) {
  const { locale } = await params;
  const { state } = await searchParams;
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
  let query = supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (state) query = query.eq("state", state as OrderState);

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
      />
    </AdminShell>
  );
}
