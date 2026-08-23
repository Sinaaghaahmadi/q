import { Building2 } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import * as React from "react";
import { EmptyState } from "@/components/layout/empty-state";
import { OfficeIdentityCard } from "@/components/office/office-identity-card";
import { OfficeSettingsForm } from "@/components/office/office-settings-form";
import { OfficeShell } from "@/components/office/office-shell";
import { redirect } from "@/i18n/navigation";
import { can, officeScopes } from "@/lib/auth/can";
import { createClient, getSessionProfile, isSupabaseConfigured } from "@/lib/supabase/server";
import type { ExchangeOffice, Json } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "officePanel.config" });
  return { title: t("settings.metaTitle") };
}

export default async function OfficeSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("officePanel");
  const tc = await getTranslations("officePanel.config");

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

  const session = await getSessionProfile();
  if (!session?.user) {
    redirect({ href: "/signin?next=/office/settings", locale });
  }

  const seats = session?.memberships ?? [];
  const officeId = officeScopes(seats)[0];
  if (!officeId) {
    return (
      <EmptyState
        icon={Building2}
        title={t("notAMemberTitle")}
        description={t("notAMemberBody")}
        ctaLabel={t("backHome")}
      />
    );
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("exchange_offices")
    .select("*")
    .eq("id", officeId)
    .maybeSingle();

  // `auto_accept_rules` is selected by `*` and typed nowhere, so it is widened
  // here once rather than inside the form.
  const office = (data ?? null) as (ExchangeOffice & { auto_accept_rules?: Json }) | null;
  if (!office) {
    return (
      <EmptyState
        icon={Building2}
        title={t("notAMemberTitle")}
        description={t("notAMemberBody")}
        ctaLabel={t("backHome")}
      />
    );
  }

  return (
    <OfficeShell
      office={office}
      locale={locale}
      title={tc("settings.title")}
      description={tc("settings.subtitle")}
    >
      {/* The office's own face, first: it is the thing an owner opens this page
          to look at, and the only part of it they may change themselves. */}
      <div className="mb-5">
        <OfficeIdentityCard
          office={office}
          canEdit={can(seats, "office.team", office.id) || can(seats, "office.configure")}
        />
      </div>

      <OfficeSettingsForm
        office={office}
        autoAcceptRules={office.auto_accept_rules ?? {}}
        // `offices_admin_write` is the only write policy on this table, and it
        // names platform seats — an office owner may read every field here and
        // write none of them.
        canWrite={can(seats, "office.configure")}
      />
    </OfficeShell>
  );
}
