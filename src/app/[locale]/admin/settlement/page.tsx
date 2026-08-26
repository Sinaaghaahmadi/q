import { Landmark } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import * as React from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { EmptyState } from "@/components/layout/empty-state";
import { SettlementView } from "@/components/settlement/settlement-view";
import { redirect } from "@/i18n/navigation";
import { getAdminContext } from "@/lib/auth/admin-context";
import { can } from "@/lib/auth/can";
import type { AppLocale } from "@/lib/money/format";
import { loadSettlementGroups } from "@/lib/settlement/accounts";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "settlement" });
  return { title: t("adminMetaTitle") };
}

export default async function AdminSettlementPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("settlement");

  if (!isSupabaseConfigured()) {
    return (
      <EmptyState
        icon={Landmark}
        hue="brand"
        title={t("unavailableTitle")}
        description={t("unavailableBody")}
        ctaLabel={t("backHome")}
      />
    );
  }

  const ctx = await getAdminContext();
  if (!ctx) redirect({ href: "/signin?next=/admin/settlement", locale });
  if (!ctx || !can(ctx.seats, "office.configure")) {
    return (
      <EmptyState
        icon={Landmark}
        hue="brand"
        title={t("forbiddenTitle")}
        description={t("forbiddenBody")}
        ctaLabel={t("backHome")}
      />
    );
  }

  const groups = await loadSettlementGroups(locale);

  return (
    <AdminShell
      seats={ctx.seats}
      impersonation={ctx.impersonation}
      office={ctx.impersonatedOffice}
      title={t("title")}
      description={t("adminSubtitle")}
    >
      <SettlementView groups={groups} locale={locale as AppLocale} canManage scope="platform" />
    </AdminShell>
  );
}
