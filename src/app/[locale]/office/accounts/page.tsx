import { Building2 } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import * as React from "react";
import { MaintenanceScene, NoAccessScene } from "@/components/brand/scenes/states";
import { EmptyState } from "@/components/layout/empty-state";
import { AccountsEditor } from "@/components/office/accounts-editor";
import { OfficeShell } from "@/components/office/office-shell";
import { redirect } from "@/i18n/navigation";
import { can, officeScopes } from "@/lib/auth/can";
import { createClient, getSessionProfile, isSupabaseConfigured } from "@/lib/supabase/server";
import type { ExchangeOffice, OfficeAccount } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "officePanel.money" });
  return { title: t("accounts.metaTitle") };
}

export default async function OfficeAccountsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("officePanel");
  const tm = await getTranslations("officePanel.money");

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

  const session = await getSessionProfile();
  if (!session?.user) {
    redirect({ href: "/signin?next=/office/accounts", locale });
  }

  const seats = session?.memberships ?? [];
  const officeId = officeScopes(seats)[0];
  if (!officeId) {
    return (
      <EmptyState
        icon={Building2}
        scene={NoAccessScene}
        title={t("notAMemberTitle")}
        description={t("notAMemberBody")}
        ctaLabel={t("backHome")}
      />
    );
  }

  const supabase = await createClient();
  const [{ data: office }, { data: accounts }] = await Promise.all([
    supabase.from("exchange_offices").select("*").eq("id", officeId).maybeSingle(),
    supabase
      .from("office_accounts")
      .select("*")
      .eq("office_id", officeId)
      .is("deleted_at", null)
      .order("created_at"),
  ]);

  return (
    <OfficeShell
      office={(office ?? null) as ExchangeOffice | null}
      locale={locale}
      title={tm("accounts.title")}
      description={tm("accounts.subtitle")}
    >
      <AccountsEditor
        officeId={officeId}
        accounts={(accounts ?? []) as OfficeAccount[]}
        canManage={can(seats, "office.finance", officeId)}
      />
    </OfficeShell>
  );
}
