import { Building2 } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import * as React from "react";
import { EmptyState } from "@/components/layout/empty-state";
import { OfficeInbox } from "@/components/office/inbox";
import { redirect } from "@/i18n/navigation";
import { createClient, getSessionProfile, isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "office" });
  return { title: t("metaTitle") };
}

export default async function OfficePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("office");

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
    redirect({ href: "/signin?next=/office", locale });
  }

  // Membership decides which office this is. Someone in more than one lands on
  // the first for now; picking between them belongs with the Phase-4 panel.
  const membership = session?.memberships.find(
    (m) => m.scope_type === "office" && m.scope_id !== null,
  );
  if (!membership?.scope_id) {
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
  const [{ data: office }, { data: pool }, { data: mine }] = await Promise.all([
    supabase.from("exchange_offices").select("*").eq("id", membership.scope_id).maybeSingle(),
    // The matching-pool policy makes these visible to any active office member;
    // everything else stays invisible, so no extra filtering is needed here.
    supabase
      .from("orders")
      .select("*")
      .is("office_id", null)
      .eq("state", "matching")
      .order("created_at")
      .limit(50),
    supabase
      .from("orders")
      .select("*")
      .eq("office_id", membership.scope_id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

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
    <div className="py-4">
      <OfficeInbox
        officeId={office.id}
        officeName={locale === "fa" ? office.legal_name_fa : office.legal_name_en}
        pool={pool ?? []}
        mine={mine ?? []}
      />
    </div>
  );
}
