import { ShieldAlert, SlidersHorizontal } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import * as React from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { FeatureFlags } from "@/components/admin/feature-flags";
import { StaffSecurity, type StaffMfaState } from "@/components/admin/staff-security";
import { EmptyState } from "@/components/layout/empty-state";
import { redirect } from "@/i18n/navigation";
import { getAdminContext } from "@/lib/auth/admin-context";
import { can } from "@/lib/auth/can";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { FeatureFlag } from "@/lib/supabase/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });
  return { title: t("settings.metaTitle") };
}

export default async function AdminSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  if (!isSupabaseConfigured()) {
    return (
      <EmptyState
        icon={SlidersHorizontal}
        hue="slate"
        title={t("unavailableTitle")}
        description={t("unavailableBody")}
        ctaLabel={t("backHome")}
      />
    );
  }

  const ctx = await getAdminContext();
  if (!ctx) redirect({ href: "/signin?next=/admin/settings", locale });
  if (!ctx || !can(ctx.seats, "platform.config")) {
    return (
      <EmptyState
        icon={ShieldAlert}
        hue="indigo"
        title={t("forbiddenTitle")}
        description={t("forbiddenBody")}
        ctaLabel={t("backHome")}
      />
    );
  }

  const supabase = await createClient();
  const [{ data: flags }, { data: defaults }, { data: mfa }] = await Promise.all([
    supabase.from("feature_flags").select("*").is("deleted_at", null).order("key"),
    supabase.rpc("office_defaults"),
    // Refuses for anyone but an administrator, which is the same gate this page
    // already passed — so a null here means the call failed, not that the
    // reader is unwelcome, and the section simply does not render.
    supabase.rpc("staff_mfa_state"),
  ]);

  return (
    <AdminShell
      seats={ctx.seats}
      impersonation={ctx.impersonation}
      office={ctx.impersonatedOffice}
      title={t("settings.title")}
      description={t("settings.subtitle")}
    >
      {mfa ? <StaffSecurity state={mfa as unknown as StaffMfaState} /> : null}
      <FeatureFlags flags={(flags ?? []) as FeatureFlag[]} defaults={defaults ?? null} />
    </AdminShell>
  );
}
