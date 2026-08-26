import { Building2 } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import * as React from "react";
import { EmptyState } from "@/components/layout/empty-state";
import { OfficeShell } from "@/components/office/office-shell";
import { TicketQueue } from "@/components/support/ticket-queue";
import { redirect } from "@/i18n/navigation";
import { officeScopes } from "@/lib/auth/can";
import type { AppLocale } from "@/lib/money/format";
import { loadTicketQueue, ticketResponseHours } from "@/lib/support/tickets";
import { createClient, getSessionProfile, isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "tickets" });
  return { title: t("officeTitle") };
}

export default async function OfficeTicketsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("tickets");
  const shell = await getTranslations("officePanel");

  if (!isSupabaseConfigured()) {
    return (
      <EmptyState
        icon={Building2}
        hue="slate"
        title={shell("unavailableTitle")}
        description={shell("unavailableBody")}
        ctaLabel={shell("backHome")}
      />
    );
  }

  const session = await getSessionProfile();
  if (!session?.user) {
    redirect({ href: "/signin?next=/office/tickets", locale });
  }

  const officeId = officeScopes(session?.memberships ?? [])[0];
  if (!officeId) {
    return (
      <EmptyState
        icon={Building2}
        hue="indigo"
        title={shell("notAMemberTitle")}
        description={shell("notAMemberBody")}
        ctaLabel={shell("backHome")}
      />
    );
  }

  // RLS scopes this to the office's own tickets; no filter is applied here on
  // purpose, so there is exactly one place that decides who sees what.
  const supabase = await createClient();
  const [{ data: office }, rows, hours] = await Promise.all([
    supabase
      .from("exchange_offices")
      .select("id, legal_name_fa, legal_name_en, display_name, logo_path, status")
      .eq("id", officeId)
      .maybeSingle(),
    loadTicketQueue(locale as AppLocale),
    ticketResponseHours(),
  ]);

  return (
    <OfficeShell
      office={office ?? null}
      locale={locale}
      title={t("officeTitle")}
      description={t("officeSubtitle", { hours })}
    >
      <TicketQueue rows={rows} scope="office" responseHours={hours} />
    </OfficeShell>
  );
}
