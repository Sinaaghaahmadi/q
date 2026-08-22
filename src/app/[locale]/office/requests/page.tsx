import { Building2, CircleAlert } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import * as React from "react";
import { EmptyState } from "@/components/layout/empty-state";
import { OfficeShell } from "@/components/office/office-shell";
import { RequestsQueue } from "@/components/office/requests-queue";
import { redirect } from "@/i18n/navigation";
import { officeScopes } from "@/lib/auth/can";
import { ALLOWED_TRANSITIONS } from "@/lib/orders/flow";
import { createClient, getSessionProfile, isSupabaseConfigured } from "@/lib/supabase/server";
import type { ExchangeOffice, Order, OrderState } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

/**
 * Settled work has to be excluded by the query, not by a pass over the result:
 * `state_since` is rewritten on every transition, so an order that finished
 * months ago carries the oldest timestamp of all and sorts to the front. A
 * filter applied afterwards would throw away the whole window and leave a busy
 * office staring at an empty queue. The set is derived from the transition map
 * — a state nothing leaves is a state this office is finished with — so it
 * cannot drift from the machine the way a second hand-written list would.
 */
const SETTLED = `(${(Object.entries(ALLOWED_TRANSITIONS) as [OrderState, OrderState[]][])
  .filter(([, onward]) => onward.length === 0)
  .map(([state]) => state)
  .join(",")})`;

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
    supabase
      .from("orders")
      .select("*")
      .eq("office_id", officeId)
      .not("state", "in", SETTLED)
      .order("state_since")
      .limit(200),
  ]);

  const orders = [...((pool ?? []) as Order[]), ...((mine ?? []) as Order[])];
  const officeRow = (office ?? null) as ExchangeOffice | null;

  // `orders_matching_pool` only opens to members of an *active* office, so a
  // suspended one sees no unclaimed requests at all. Without a word to that
  // effect the screen says "nothing is in progress" and the operator reads it
  // as a quiet morning. Their own work still shows — being suspended stops new
  // requests arriving, not the ones already on the counter.
  const poolClosed = officeRow !== null && officeRow.status !== "active";

  return (
    <OfficeShell office={officeRow} locale={locale} title={t("title")} description={t("subtitle")}>
      <div className="space-y-4">
        {poolClosed ? (
          <p className="flex items-start gap-1.5 rounded-xl bg-warn/12 p-3 text-sm text-warn-ink">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t("poolClosed")}
          </p>
        ) : null}
        <RequestsQueue officeId={officeId} orders={orders} />
      </div>
    </OfficeShell>
  );
}
