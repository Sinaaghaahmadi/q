import { Building2 } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import * as React from "react";
import { EmptyState } from "@/components/layout/empty-state";
import { OfficeShell } from "@/components/office/office-shell";
import { RequestsQueue, type QueueRow } from "@/components/office/requests-queue";
import { redirect } from "@/i18n/navigation";
import { officeScopes } from "@/lib/auth/can";
import { isDone } from "@/lib/office/steps";
import { createClient, getSessionProfile, isSupabaseConfigured } from "@/lib/supabase/server";
import type { ExchangeOffice, Order } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "officePanel.requests" });
  return { title: t("metaTitle") };
}

export default async function OfficeRequestsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("officePanel.requests");
  const shell = await getTranslations("officePanel");

  if (!isSupabaseConfigured()) {
    return (
      <EmptyState
        icon={Building2}
        title={shell("unavailableTitle")}
        description={shell("unavailableBody")}
        ctaLabel={shell("backHome")}
      />
    );
  }

  const session = await getSessionProfile();
  if (!session?.user) {
    redirect({ href: "/signin?next=/office/requests", locale });
  }

  const officeId = officeScopes(session?.memberships ?? [])[0];
  if (!officeId) {
    return (
      <EmptyState
        icon={Building2}
        title={shell("notAMemberTitle")}
        description={shell("notAMemberBody")}
        ctaLabel={shell("backHome")}
      />
    );
  }

  const supabase = await createClient();
  const [{ data: office }, { data: pool }, { data: mine }] = await Promise.all([
    supabase.from("exchange_offices").select("*").eq("id", officeId).maybeSingle(),
    // Oldest wait first in both halves: a queue that reorders itself by anything
    // else lets the request nobody wanted sink out of sight.
    supabase
      .from("orders")
      .select("*")
      .is("office_id", null)
      .eq("state", "matching")
      .order("state_since")
      .limit(100),
    supabase.from("orders").select("*").eq("office_id", officeId).order("state_since").limit(200),
  ]);

  const orders = [
    ...((pool ?? []) as Order[]),
    ...((mine ?? []) as Order[]).filter((o) => !isDone(o.state)),
  ];

  const customerIds = [...new Set(orders.map((o) => o.customer_id))];
  const { data: profiles } = customerIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name_fa, full_name_latin")
        .in("id", customerIds)
    : { data: [] };

  const names = new Map(
    (profiles ?? []).map((p) => [
      p.id,
      (locale === "fa"
        ? (p.full_name_fa ?? p.full_name_latin)
        : (p.full_name_latin ?? p.full_name_fa)) ?? null,
    ]),
  );

  const rows: QueueRow[] = orders.map((order) => ({
    order,
    customerName: names.get(order.customer_id) ?? null,
  }));

  return (
    <OfficeShell
      office={(office ?? null) as ExchangeOffice | null}
      locale={locale}
      title={t("title")}
      description={t("subtitle")}
    >
      <RequestsQueue officeId={officeId} rows={rows} />
    </OfficeShell>
  );
}
