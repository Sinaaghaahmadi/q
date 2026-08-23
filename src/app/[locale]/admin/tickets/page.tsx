import { ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import * as React from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { EmptyState } from "@/components/layout/empty-state";
import { TicketQueue } from "@/components/support/ticket-queue";
import { redirect } from "@/i18n/navigation";
import { getAdminContext } from "@/lib/auth/admin-context";
import { isPlatformStaff } from "@/lib/auth/can";
import type { AppLocale } from "@/lib/money/format";
import { loadTicketQueue, ticketResponseHours } from "@/lib/support/tickets";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "tickets" });
  return { title: t("adminTitle") };
}

/**
 * Every ticket on the platform, including the ones an office is sitting on.
 *
 * This is the concrete meaning of the platform being above the office: the same
 * queue component, but nothing is scoped away, and the escalate control reads
 * "pull up" rather than "hand over".
 */
export default async function AdminTicketsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("tickets");
  const admin = await getTranslations("admin");

  if (!isSupabaseConfigured()) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title={admin("unavailableTitle")}
        description={admin("unavailableBody")}
        ctaLabel={admin("backHome")}
      />
    );
  }

  const ctx = await getAdminContext();
  if (!ctx) redirect({ href: "/signin?next=/admin/tickets", locale });
  if (!ctx || !isPlatformStaff(ctx.seats)) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title={admin("forbiddenTitle")}
        description={admin("forbiddenBody")}
        ctaLabel={admin("backHome")}
      />
    );
  }

  const [rows, hours] = await Promise.all([
    loadTicketQueue(locale as AppLocale),
    ticketResponseHours(),
  ]);

  return (
    <AdminShell
      seats={ctx.seats}
      impersonation={ctx.impersonation}
      title={t("adminTitle")}
      description={t("adminSubtitle", { hours })}
    >
      <TicketQueue rows={rows} scope="platform" responseHours={hours} />
    </AdminShell>
  );
}
