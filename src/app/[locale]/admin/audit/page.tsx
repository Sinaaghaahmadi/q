import { FileClock, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import * as React from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { AuditTrail } from "@/components/admin/audit-trail";
import { EmptyState } from "@/components/layout/empty-state";
import { redirect } from "@/i18n/navigation";
import { getAdminContext } from "@/lib/auth/admin-context";
import { can } from "@/lib/auth/can";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { AuditLogEntry } from "@/lib/supabase/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });
  return { title: t("audit.metaTitle") };
}

export default async function AdminAuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; entity?: string }>;
}) {
  const { locale } = await params;
  const { q, entity } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  if (!isSupabaseConfigured()) {
    return (
      <EmptyState
        icon={FileClock}
        hue="slate"
        title={t("unavailableTitle")}
        description={t("unavailableBody")}
        ctaLabel={t("backHome")}
      />
    );
  }

  const ctx = await getAdminContext();
  if (!ctx) redirect({ href: "/signin?next=/admin/audit", locale });
  if (!ctx || !can(ctx.seats, "platform.audit")) {
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
  let query = supabase
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (entity) query = query.eq("entity_type", entity);
  // `action` is ours, not user input, so an ilike prefix match is the whole
  // search this needs; free-text over jsonb diffs would be a different feature.
  if (q) query = query.ilike("action", `%${q}%`);

  const { data: entries } = await query;

  return (
    <AdminShell
      seats={ctx.seats}
      impersonation={ctx.impersonation}
      office={ctx.impersonatedOffice}
      title={t("audit.title")}
      description={t("audit.subtitle")}
    >
      <AuditTrail
        entries={(entries ?? []) as AuditLogEntry[]}
        query={q ?? ""}
        entity={entity ?? ""}
      />
    </AdminShell>
  );
}
