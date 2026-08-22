import { ShieldAlert, Users } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import * as React from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminUserTable, type AccessFilter, type UserRow } from "@/components/admin/user-table";
import { EmptyState } from "@/components/layout/empty-state";
import { KYC_STATUSES } from "@/lib/admin/filters";
import { redirect } from "@/i18n/navigation";
import { getAdminContext } from "@/lib/auth/admin-context";
import { can } from "@/lib/auth/can";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { Order } from "@/lib/supabase/types";

/** Only the legs the per-customer totals need. */
type OrderLeg = Pick<
  Order,
  "customer_id" | "state" | "send_currency" | "send_amount_minor" | "receive_amount_minor"
>;

/**
 * How the fold below is read. PostgREST carries `in.(…)` in the request line, so
 * 200 uuids at once is some 7 KB of header and close enough to the usual 8 KB
 * buffer to be refused outright; and an unbounded select is capped server-side
 * without saying so, which would quietly understate a customer's count and
 * volume. Hence a batch of ids at a time, paged to a ceiling this page can name
 * on screen when it reaches it.
 */
const IDS_PER_READ = 50;
const LEGS_PAGE = 1000;
const LEGS_MAX_PAGES = 5;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });
  return { title: t("users.metaTitle") };
}

export default async function AdminUsersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; kyc?: string; frozen?: string }>;
}) {
  const { locale } = await params;
  const { q, kyc, frozen } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  if (!isSupabaseConfigured()) {
    return (
      <EmptyState
        icon={Users}
        title={t("unavailableTitle")}
        description={t("unavailableBody")}
        ctaLabel={t("backHome")}
      />
    );
  }

  const ctx = await getAdminContext();
  if (!ctx) redirect({ href: "/signin?next=/admin/users", locale });
  if (!ctx || !can(ctx.seats, "platform.oversee")) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title={t("forbiddenTitle")}
        description={t("forbiddenBody")}
        ctaLabel={t("backHome")}
      />
    );
  }

  const supabase = await createClient();
  let query = supabase
    .from("profiles")
    .select(
      "id, full_name_fa, full_name_latin, phone, kyc_status, risk_tier, frozen_at, created_at",
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);

  // PostgREST reads `or=` as its own little grammar, so a comma or a bracket in
  // the search box would be parsed as filter syntax rather than as a name.
  const needle = (q ?? "")
    .trim()
    .replace(/[,()%*\\]/g, " ")
    .slice(0, 60);
  if (needle) {
    query = query.or(
      `full_name_fa.ilike.%${needle}%,full_name_latin.ilike.%${needle}%,phone.ilike.%${needle}%`,
    );
  }
  // `kyc_status` is an enum, so an unknown `?kyc=` reaches Postgres as an invalid
  // literal and fails the whole select — which on screen reads as "no customer
  // matches these filters" rather than as the broken query it is.
  const kycFilter = KYC_STATUSES.find((status) => status === kyc);
  if (kycFilter) query = query.eq("kyc_status", kycFilter);
  if (frozen === "yes") query = query.not("frozen_at", "is", null);
  if (frozen === "no") query = query.is("frozen_at", null);

  const { data: profiles } = await query;

  // Totals are folded from the orders of the customers actually on screen, so
  // narrowing the search narrows the second query too. Soft-deleted orders are
  // left out because `customer_volume_irt` leaves them out as well; counting
  // them here would put a different number under the same word on this screen
  // and on the customer's own file.
  const ids = (profiles ?? []).map((p) => p.id);
  const legs: OrderLeg[] = [];
  let truncated = false;
  for (let from = 0; from < ids.length; from += IDS_PER_READ) {
    const batch = ids.slice(from, from + IDS_PER_READ);
    let read = 0;
    let total = 0;
    for (let page = 0; page < LEGS_MAX_PAGES; page += 1) {
      // The window opens where the last read actually stopped, not at a multiple
      // of the page size, because PostgREST answers with its own row ceiling when
      // that is the smaller of the two — and stepping by the size we asked for
      // would step over whatever it withheld. The exact count is what decides
      // whether anything is still missing, rather than a short page.
      const { data, count } = await supabase
        .from("orders")
        .select("customer_id, state, send_currency, send_amount_minor, receive_amount_minor", {
          count: "exact",
        })
        .in("customer_id", batch)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(read, read + LEGS_PAGE - 1);
      const rows = (data ?? []) as OrderLeg[];
      legs.push(...rows);
      read += rows.length;
      total = count ?? read;
      if (rows.length === 0 || read >= total) break;
    }
    if (read < total) truncated = true;
  }

  const totals = new Map<string, { orders: number; volumeMinor: number }>();
  for (const leg of legs) {
    const row = totals.get(leg.customer_id) ?? { orders: 0, volumeMinor: 0 };
    row.orders += 1;
    // Volume is money that actually moved; an order in flight or cancelled
    // would flatter the figure without ever reaching a till.
    if (leg.state === "completed") {
      row.volumeMinor +=
        leg.send_currency === "IRT" ? leg.send_amount_minor : leg.receive_amount_minor;
    }
    totals.set(leg.customer_id, row);
  }

  const users: UserRow[] = (profiles ?? []).map((profile) => ({
    ...profile,
    orders: totals.get(profile.id)?.orders ?? 0,
    volumeMinor: totals.get(profile.id)?.volumeMinor ?? 0,
  }));

  return (
    <AdminShell
      seats={ctx.seats}
      impersonation={ctx.impersonation}
      office={ctx.impersonatedOffice}
      title={t("users.title")}
      description={t("users.subtitle")}
    >
      <AdminUserTable
        users={users}
        query={q ?? ""}
        kyc={kycFilter ?? ""}
        access={(frozen === "yes" || frozen === "no" ? frozen : "") as AccessFilter}
        totalsTruncated={truncated}
      />
    </AdminShell>
  );
}
