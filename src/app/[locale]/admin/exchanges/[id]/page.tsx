import { Building2, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import * as React from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { OfficeConfig } from "@/components/admin/office-config";
import { OfficeVerification } from "@/components/admin/office-verification";
import { EmptyState } from "@/components/layout/empty-state";
import { redirect } from "@/i18n/navigation";
import { getAdminContext } from "@/lib/auth/admin-context";
import { can } from "@/lib/auth/can";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type {
  ExchangeOffice,
  OfficeAccount,
  OfficeBalance,
  OfficeRateConfig,
} from "@/lib/supabase/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });
  return { title: t("exchanges.metaTitle") };
}

export default async function AdminExchangeDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  if (!isSupabaseConfigured()) {
    return (
      <EmptyState
        icon={Building2}
        title={t("unavailableTitle")}
        description={t("unavailableBody")}
        ctaLabel={t("backHome")}
      />
    );
  }

  const ctx = await getAdminContext();
  if (!ctx) redirect({ href: `/signin?next=/admin/exchanges/${id}`, locale });
  if (!ctx || !can(ctx.seats, "office.configure")) {
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
  const { data: office } = await supabase
    .from("exchange_offices")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!office) notFound();

  const [
    { data: accounts },
    { data: rates },
    { data: balances },
    { data: defaults },
    { data: orders },
  ] = await Promise.all([
    supabase.from("office_accounts").select("*").eq("office_id", id).is("deleted_at", null),
    supabase.from("office_rate_config").select("*").eq("office_id", id).is("deleted_at", null),
    supabase.from("office_balances").select("*").eq("office_id", id),
    supabase.rpc("office_defaults"),
    supabase.from("orders").select("state").eq("office_id", id),
  ]);

  return (
    <AdminShell
      seats={ctx.seats}
      impersonation={ctx.impersonation}
      office={ctx.impersonatedOffice}
      title={office.display_name ?? (locale === "fa" ? office.legal_name_fa : office.legal_name_en)}
      description={`${office.slug} · ${office.license_no}`}
    >
      {/* Identity first: everything below it — rates, accounts, activation — is
          only worth configuring for an office we believe is who it says it is. */}
      <div className="mb-5">
        <OfficeVerification office={office as ExchangeOffice} />
      </div>

      <OfficeConfig
        office={office as ExchangeOffice}
        accounts={(accounts ?? []) as OfficeAccount[]}
        rates={(rates ?? []) as OfficeRateConfig[]}
        balances={(balances ?? []) as OfficeBalance[]}
        defaults={defaults ?? null}
        orderCount={(orders ?? []).length}
        canImpersonate={can(ctx.seats, "office.impersonate")}
        impersonatingHere={ctx.impersonation?.office_id === office.id}
      />
    </AdminShell>
  );
}
