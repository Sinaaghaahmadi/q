import { Handshake, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import * as React from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { P2pModeration } from "@/components/admin/p2p-moderation";
import { EmptyState } from "@/components/layout/empty-state";
import { redirect } from "@/i18n/navigation";
import { getAdminContext } from "@/lib/auth/admin-context";
import { isPlatformStaff } from "@/lib/auth/can";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { Order, P2pOffer, P2pTrade } from "@/lib/supabase/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });
  return { title: t("p2p.metaTitle") };
}

export default async function AdminP2pPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  if (!isSupabaseConfigured()) {
    return (
      <EmptyState
        icon={Handshake}
        hue="teal"
        title={t("unavailableTitle")}
        description={t("unavailableBody")}
        ctaLabel={t("backHome")}
      />
    );
  }

  const ctx = await getAdminContext();
  if (!ctx) redirect({ href: "/signin?next=/admin/p2p", locale });
  if (!ctx || !isPlatformStaff(ctx.seats)) {
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
  const [{ data: offers }, { data: trades }, { data: disputed }] = await Promise.all([
    supabase.from("p2p_offers").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("p2p_trades").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("orders").select("*").eq("is_p2p", true).eq("state", "disputed"),
  ]);

  return (
    <AdminShell
      seats={ctx.seats}
      impersonation={ctx.impersonation}
      office={ctx.impersonatedOffice}
      title={t("p2p.title")}
      description={t("p2p.subtitle")}
    >
      <P2pModeration
        offers={(offers ?? []) as P2pOffer[]}
        trades={(trades ?? []) as P2pTrade[]}
        disputed={(disputed ?? []) as Order[]}
      />
    </AdminShell>
  );
}
