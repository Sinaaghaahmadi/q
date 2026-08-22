import { Building2 } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import * as React from "react";
import { EmptyState } from "@/components/layout/empty-state";
import {
  OfficeReports,
  type CorridorSlice,
  type MonthBar,
} from "@/components/office/office-reports";
import { OfficeShell } from "@/components/office/office-shell";
import { redirect } from "@/i18n/navigation";
import { officeScopes } from "@/lib/auth/can";
import { gregorianToJalali, jalaliToGregorian } from "@/lib/date/jalali";
import { createClient, getSessionProfile, isSupabaseConfigured } from "@/lib/supabase/server";
import type { ExchangeOffice, Order, OrderEvent } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

const MONTHS = 6;

/** The columns a report needs; the rest of an order is not read for a total. */
type ReportLeg = Pick<
  Order,
  | "id"
  | "corridor"
  | "state"
  | "send_currency"
  | "send_amount_minor"
  | "receive_amount_minor"
  | "created_at"
  | "due_at"
>;

/**
 * The six month boundaries, in the calendar the reader actually keeps books in.
 *
 * A Persian office closes its month on the last of Esfand, not on 31 December,
 * so bucketing into Gregorian months and then printing a Jalali label would put
 * the wrong number under every bar. The boundaries are built in the display
 * calendar instead, and the label is simply that bucket's own first day.
 */
function monthStarts(locale: string, now: Date): Date[] {
  const starts: Date[] = [];
  if (locale === "fa") {
    const { jy, jm } = gregorianToJalali(now);
    const index = jy * 12 + (jm - 1);
    for (let back = MONTHS - 1; back >= 0; back -= 1) {
      const month = index - back;
      starts.push(jalaliToGregorian(Math.floor(month / 12), (month % 12) + 1, 1));
    }
    return starts;
  }
  for (let back = MONTHS - 1; back >= 0; back -= 1) {
    starts.push(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1)));
  }
  return starts;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "officePanel.reports" });
  return { title: t("metaTitle") };
}

export default async function OfficeReportsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("officePanel.reports");
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
    redirect({ href: "/signin?next=/office/reports", locale });
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

  const starts = monthStarts(locale, new Date());
  const windowStart = starts[0]!;

  const supabase = await createClient();
  const [{ data: office }, { data: legs }] = await Promise.all([
    supabase.from("exchange_offices").select("*").eq("id", officeId).maybeSingle(),
    supabase
      .from("orders")
      .select(
        "id, corridor, state, send_currency, send_amount_minor, receive_amount_minor, created_at, due_at",
      )
      .eq("office_id", officeId)
      .gte("created_at", windowStart.toISOString())
      .order("created_at")
      .limit(2000),
  ]);

  const orders = (legs ?? []) as ReportLeg[];
  const completed = orders.filter((order) => order.state === "completed");

  // Only the completed orders need their history: the two figures below are the
  // gap between an order's first event and its completion, and whether that
  // completion beat the deadline. Everything still open has neither yet.
  //
  // Naming those orders in the query would put a uuid each into the URL, and a
  // few hundred completions is enough query string to be refused outright — at
  // which point the page would report an idle office. `order_events_visibility`
  // already narrows the table to this office's orders, so the window is read
  // whole and the completed ones picked out here.
  const completedIds = new Set(completed.map((order) => order.id));
  let events: Pick<OrderEvent, "order_id" | "to_state" | "created_at">[] = [];
  if (completedIds.size > 0) {
    const { data } = await supabase
      .from("order_events")
      .select("order_id, to_state, created_at")
      .gte("created_at", windowStart.toISOString())
      .limit(8000);
    events = data ?? [];
  }

  // Read without an order clause, so first and last are found by comparison
  // rather than by trusting the rows to arrive in timeline order.
  const opened = new Map<string, string>();
  const closed = new Map<string, string>();
  for (const event of events) {
    if (!completedIds.has(event.order_id)) continue;
    const firstSoFar = opened.get(event.order_id);
    if (!firstSoFar || Date.parse(event.created_at) < Date.parse(firstSoFar)) {
      opened.set(event.order_id, event.created_at);
    }
    if (event.to_state === "completed") {
      const lastSoFar = closed.get(event.order_id);
      if (!lastSoFar || Date.parse(event.created_at) > Date.parse(lastSoFar)) {
        closed.set(event.order_id, event.created_at);
      }
    }
  }

  const months: MonthBar[] = starts.map((start, index) => {
    const from = start.getTime();
    const until = starts[index + 1]?.getTime() ?? Number.POSITIVE_INFINITY;
    const inMonth = orders.filter((order) => {
      const at = Date.parse(order.created_at);
      return at >= from && at < until;
    });
    return {
      start: start.toISOString(),
      orders: inMonth.length,
      volumeMinor: inMonth
        .filter((order) => order.state === "completed")
        .reduce(
          (sum, order) =>
            sum +
            (order.send_currency === "IRT" ? order.send_amount_minor : order.receive_amount_minor),
          0,
        ),
    };
  });

  const byCorridor = new Map<string, number>();
  for (const order of orders) {
    byCorridor.set(order.corridor, (byCorridor.get(order.corridor) ?? 0) + 1);
  }
  const corridors: CorridorSlice[] = [...byCorridor]
    .map(([corridor, count]) => ({ corridor, orders: count }))
    .sort((a, b) => b.orders - a.orders);

  const durations = completed
    .map((order) => {
      const from = opened.get(order.id);
      const until = closed.get(order.id);
      return from && until ? Date.parse(until) - Date.parse(from) : null;
    })
    .filter((ms): ms is number => ms !== null && ms >= 0);

  const judged = completed.filter((order) => order.due_at !== null && closed.has(order.id));

  return (
    <OfficeShell
      office={(office ?? null) as ExchangeOffice | null}
      locale={locale}
      title={t("title")}
      description={t("subtitle")}
    >
      <OfficeReports
        months={months}
        corridors={corridors}
        totalOrders={orders.length}
        totalVolumeMinor={months.reduce((sum, month) => sum + month.volumeMinor, 0)}
        completion={
          durations.length > 0
            ? {
                sampled: durations.length,
                averageMinutes:
                  durations.reduce((sum, ms) => sum + ms, 0) / durations.length / 60_000,
              }
            : null
        }
        sla={
          judged.length > 0
            ? {
                measured: judged.length,
                onTime: judged.filter(
                  (order) => Date.parse(closed.get(order.id)!) <= Date.parse(order.due_at!),
                ).length,
              }
            : null
        }
      />
    </OfficeShell>
  );
}
