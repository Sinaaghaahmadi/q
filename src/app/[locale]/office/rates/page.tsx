import { Building2 } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import * as React from "react";
import { EmptyState } from "@/components/layout/empty-state";
import { OfficeShell } from "@/components/office/office-shell";
import { RateConfigEditor } from "@/components/office/rate-config-editor";
import { redirect } from "@/i18n/navigation";
import { can, officeScopes } from "@/lib/auth/can";
import { createClient, getSessionProfile, isSupabaseConfigured } from "@/lib/supabase/server";
import type { ExchangeOffice, Json, OfficeRateConfig } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "officePanel.config" });
  return { title: t("rates.metaTitle") };
}

export default async function OfficeRatesPage({ params }: { params: Promise<{ locale: string }> }) {
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
    redirect({ href: "/signin?next=/office/rates", locale });
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
  // `office_defaults()` is the same template the admin screen diffs against, so
  // "overridden" means the same thing on both sides of the platform boundary.
  const [{ data: office }, { data: rates }, { data: defaults }] = await Promise.all([
    supabase.from("exchange_offices").select("*").eq("id", officeId).maybeSingle(),
    supabase
      .from("office_rate_config")
      .select("*")
      .eq("office_id", officeId)
      .is("deleted_at", null)
      .order("corridor"),
    supabase.rpc("office_defaults"),
  ]);

  return (
    <OfficeShell
      office={(office ?? null) as ExchangeOffice | null}
      locale={locale}
      title={tc("rates.title")}
      description={tc("rates.subtitle")}
    >
      <RateConfigEditor
        officeId={officeId}
        rates={(rates ?? []) as OfficeRateConfig[]}
        defaults={(defaults ?? null) as Json | null}
        canManage={can(seats, "office.rates", officeId)}
      />
    </OfficeShell>
  );
}
