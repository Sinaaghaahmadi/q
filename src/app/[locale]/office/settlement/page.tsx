import { Building2 } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import * as React from "react";
import { EmptyState } from "@/components/layout/empty-state";
import { OfficeShell } from "@/components/office/office-shell";
import { SettlementView } from "@/components/settlement/settlement-view";
import { redirect } from "@/i18n/navigation";
import { can, officeScopes } from "@/lib/auth/can";
import type { AppLocale } from "@/lib/money/format";
import { loadSettlementGroups } from "@/lib/settlement/accounts";
import { createClient, getSessionProfile, isSupabaseConfigured } from "@/lib/supabase/server";
import type { ExchangeOffice } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "settlement" });
  return { title: t("metaTitle") };
}

export default async function OfficeSettlementPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("officePanel");
  const ts = await getTranslations("settlement");

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
    redirect({ href: "/signin?next=/office/settlement", locale });
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
  const [{ data: office }, groups] = await Promise.all([
    supabase.from("exchange_offices").select("*").eq("id", officeId).maybeSingle(),
    loadSettlementGroups(locale, [officeId]),
  ]);

  return (
    <OfficeShell
      office={(office ?? null) as ExchangeOffice | null}
      locale={locale}
      title={ts("title")}
      description={ts("subtitle")}
    >
      <SettlementView
        groups={groups}
        locale={locale as AppLocale}
        canManage={can(seats, "office.finance", officeId)}
        scope="office"
      />
    </OfficeShell>
  );
}
