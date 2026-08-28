import { ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import * as React from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { KycQueue, type QueueRow } from "@/components/admin/kyc-queue";
import { NoAccessScene } from "@/components/brand/scenes/states";
import { EmptyState } from "@/components/layout/empty-state";
import { redirect } from "@/i18n/navigation";
import { getAdminContext } from "@/lib/auth/admin-context";
import { can } from "@/lib/auth/can";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { KycDocument } from "@/lib/supabase/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "adminKyc" });
  return { title: t("metaTitle") };
}

export default async function AdminKycPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("adminKyc");

  if (!isSupabaseConfigured()) {
    return (
      <EmptyState
        icon={ShieldAlert}
        scene={NoAccessScene}
        title={t("unavailableTitle")}
        description={t("unavailableBody")}
        ctaLabel={t("backHome")}
      />
    );
  }

  const ctx = await getAdminContext();
  if (!ctx) redirect({ href: "/signin?next=/admin/kyc", locale });

  // UI gating is convenience; RLS on kyc_submissions is what actually protects
  // the rows, so a non-reviewer simply sees nothing even if they reach here.
  if (!ctx || !can(ctx.seats, "kyc.review")) {
    return (
      <EmptyState
        icon={ShieldAlert}
        scene={NoAccessScene}
        title={t("forbiddenTitle")}
        description={t("forbiddenBody")}
        ctaLabel={t("backHome")}
      />
    );
  }

  const supabase = await createClient();
  const { data: submissions } = await supabase
    .from("kyc_submissions")
    .select("*")
    .in("status", ["pending", "more_info_needed"])
    .order("submitted_at", { ascending: true })
    .limit(50);

  const ids = (submissions ?? []).map((s) => s.id);
  const { data: documents } = ids.length
    ? await supabase.from("kyc_documents").select("*").in("submission_id", ids)
    : { data: [] as KycDocument[] };

  const rows: QueueRow[] = (submissions ?? []).map((s) => ({
    ...s,
    documents: (documents ?? []).filter((d) => d.submission_id === s.id),
  }));

  return (
    <AdminShell
      seats={ctx.seats}
      impersonation={ctx.impersonation}
      office={ctx.impersonatedOffice}
      title={t("title")}
      description={t("subtitle")}
    >
      <KycQueue rows={rows} reviewerId={ctx.userId} />
    </AdminShell>
  );
}
