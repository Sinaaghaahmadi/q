import { Building2 } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import * as React from "react";
import { EmptyState } from "@/components/layout/empty-state";
import { CustomerList, type CustomerRow } from "@/components/office/customer-list";
import { OfficeShell } from "@/components/office/office-shell";
import { redirect } from "@/i18n/navigation";
import { officeScopes } from "@/lib/auth/can";
import { createClient, getSessionProfile, isSupabaseConfigured } from "@/lib/supabase/server";
import type { ExchangeOffice, Order } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

/** Only the legs an aggregate needs — the rest of an order is nobody's business here. */
type OrderLeg = Pick<
  Order,
  | "customer_id"
  | "state"
  | "send_currency"
  | "send_amount_minor"
  | "receive_amount_minor"
  | "created_at"
>;

/** PostgREST will not return more than this in one response. */
const PAGE_SIZE = 1000;
/** A ceiling so one enormous office cannot hold the request open indefinitely. */
const MAX_PAGES = 20;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "officePanel.customers" });
  return { title: t("metaTitle") };
}

export default async function OfficeCustomersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("officePanel.customers");
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
    redirect({ href: "/signin?next=/office/customers", locale });
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

  const supabase = await createClient();

  // There is no customer table to read: a customer of this office is whoever
  // appears on its orders, so the list is folded out of the orders themselves.
  // The fold needs every order, and PostgREST caps a response at PAGE_SIZE, so
  // the pages are walked — a single capped read would have quietly turned the
  // counts and totals into the counts and totals of the most recent thousand.
  const legPage = (page: number) =>
    supabase
      .from("orders")
      .select(
        "customer_id, state, send_currency, send_amount_minor, receive_amount_minor, created_at",
      )
      .eq("office_id", officeId)
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

  const [{ data: office }, firstPage] = await Promise.all([
    supabase.from("exchange_offices").select("*").eq("id", officeId).maybeSingle(),
    legPage(0),
  ]);

  const legs = [...((firstPage.data ?? []) as OrderLeg[])];
  let truncatedAfter: number | null = null;
  for (let page = 1; legs.length === page * PAGE_SIZE; page += 1) {
    if (page >= MAX_PAGES) {
      truncatedAfter = legs.length;
      break;
    }
    const { data } = await legPage(page);
    legs.push(...((data ?? []) as OrderLeg[]));
  }

  const totals = new Map<string, { orders: number; volumeMinor: number; lastOrderAt: string }>();
  for (const leg of legs) {
    const row = totals.get(leg.customer_id) ?? {
      orders: 0,
      volumeMinor: 0,
      lastOrderAt: leg.created_at,
    };
    row.orders += 1;
    // Volume is money that actually moved: an order still in flight, cancelled
    // or refunded would flatter the figure without ever reaching a till.
    if (leg.state === "completed") {
      row.volumeMinor +=
        leg.send_currency === "IRT" ? leg.send_amount_minor : leg.receive_amount_minor;
    }
    if (Date.parse(leg.created_at) > Date.parse(row.lastOrderAt)) {
      row.lastOrderAt = leg.created_at;
    }
    totals.set(leg.customer_id, row);
  }

  const customers: CustomerRow[] = [...totals.entries()]
    .map(([id, total]) => ({ id, ...total }))
    .sort((a, b) => Date.parse(b.lastOrderAt) - Date.parse(a.lastOrderAt));

  return (
    <OfficeShell
      office={(office ?? null) as ExchangeOffice | null}
      locale={locale}
      title={t("title")}
      description={t("subtitle")}
    >
      <CustomerList customers={customers} truncatedAfter={truncatedAfter} />
    </OfficeShell>
  );
}
