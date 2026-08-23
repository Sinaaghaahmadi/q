import { Building2 } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import * as React from "react";
import { CoinQueue } from "@/components/coins/coin-queue";
import { EmptyState } from "@/components/layout/empty-state";
import { OfficeShell } from "@/components/office/office-shell";
import { redirect } from "@/i18n/navigation";
import { can, officeScopes } from "@/lib/auth/can";
import type { AppLocale } from "@/lib/money/format";
import { createClient, getSessionProfile, isSupabaseConfigured } from "@/lib/supabase/server";
import type { CoinOrder } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "coinQueue" });
  return { title: t("metaTitle") };
}

export default async function OfficeCoinsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("officePanel");
  const tq = await getTranslations("coinQueue");

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
  if (!session?.user) redirect({ href: "/signin?next=/office/coins", locale });

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
  // The policy returns this office's own requests plus the unclaimed pool, so
  // one query covers both "mine" and "available to take".
  const { data: orders } = await supabase
    .from("coin_orders")
    .select("*")
    .is("deleted_at", null)
    .order("state_since", { ascending: false })
    .limit(100);

  const [{ data: office }] = await Promise.all([
    supabase
      .from("exchange_offices")
      .select("id, legal_name_fa, legal_name_en, display_name, logo_path, status")
      .eq("id", officeId)
      .maybeSingle(),
  ]);

  return (
    <OfficeShell
      office={office ?? null}
      locale={locale}
      title={tq("title")}
      description={tq("subtitle")}
    >
      <CoinQueue
        orders={(orders ?? []) as CoinOrder[]}
        officeId={officeId}
        locale={locale as AppLocale}
        canAct={can(seats, "office.operate", officeId)}
        scope="office"
      />
    </OfficeShell>
  );
}
