import { Building2, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import * as React from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { OfficeList } from "@/components/admin/office-list";
import { OfficeWizard } from "@/components/admin/office-wizard";
import { MaintenanceScene, NoAccessScene } from "@/components/brand/scenes/states";
import { EmptyState } from "@/components/layout/empty-state";
import { redirect } from "@/i18n/navigation";
import { getAdminContext } from "@/lib/auth/admin-context";
import { can } from "@/lib/auth/can";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { ExchangeOffice } from "@/lib/supabase/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });
  return { title: t("exchanges.metaTitle") };
}

export default async function AdminExchangesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { locale } = await params;
  const { new: creating } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  if (!isSupabaseConfigured()) {
    return (
      <EmptyState
        icon={Building2}
        scene={MaintenanceScene}
        title={t("unavailableTitle")}
        description={t("unavailableBody")}
        ctaLabel={t("backHome")}
      />
    );
  }

  const ctx = await getAdminContext();
  if (!ctx) redirect({ href: "/signin?next=/admin/exchanges", locale });
  if (!ctx || !can(ctx.seats, "office.configure")) {
    return (
      <EmptyState
        icon={ShieldAlert}
        scene={NoAccessScene}
        title={t("forbiddenTitle")}
        description={t("forbiddenBody")}
        ctaLabel={t("backHome")}
      />
    );
  }

  const supabase = await createClient();
  const [{ data: offices }, { data: defaults }, { data: orders }] = await Promise.all([
    supabase.from("exchange_offices").select("*").order("created_at", { ascending: false }),
    supabase.rpc("office_defaults"),
    supabase.from("orders").select("office_id, state"),
  ]);

  const liveByOffice = new Map<string, number>();
  for (const row of orders ?? []) {
    if (!row.office_id) continue;
    if (row.state === "completed" || row.state === "cancelled") continue;
    liveByOffice.set(row.office_id, (liveByOffice.get(row.office_id) ?? 0) + 1);
  }

  return (
    <AdminShell
      seats={ctx.seats}
      impersonation={ctx.impersonation}
      office={ctx.impersonatedOffice}
      title={t("exchanges.title")}
      description={t("exchanges.subtitle")}
    >
      {creating ? (
        <OfficeWizard defaults={defaults ?? null} />
      ) : (
        <OfficeList
          offices={(offices ?? []) as ExchangeOffice[]}
          liveCounts={Object.fromEntries(liveByOffice)}
        />
      )}
    </AdminShell>
  );
}
