import { ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import * as React from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { LiveFeed } from "@/components/admin/live-feed";
import { StateBreakdown } from "@/components/admin/state-breakdown";
import { StatTile } from "@/components/admin/stat-tile";
import { EmptyState } from "@/components/layout/empty-state";
import { redirect } from "@/i18n/navigation";
import { getAdminContext } from "@/lib/auth/admin-context";
import { isPlatformStaff } from "@/lib/auth/can";
import { fromMinor } from "@/lib/money/minor";
import type { CurrencyCode } from "@/lib/rates/catalog";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { AuditLogEntry, Order, OrderState } from "@/lib/supabase/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });
  return { title: t("metaTitle") };
}

/** States that mean money is in flight and somebody is waiting on us (§17.18). */
const LIVE_STATES: OrderState[] = [
  "matching",
  "office_review",
  "accepted",
  "awaiting_irt_funding",
  "irt_funded",
  "foreign_leg_pending",
  "foreign_leg_sent",
  "recipient_confirmed",
  "irt_released",
];

export default async function AdminHomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  if (!isSupabaseConfigured()) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title={t("unavailableTitle")}
        description={t("unavailableBody")}
        ctaLabel={t("backHome")}
      />
    );
  }

  const ctx = await getAdminContext();
  if (!ctx) redirect({ href: "/signin?next=/admin", locale });
  if (!ctx || !isPlatformStaff(ctx.seats)) {
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
  const [{ data: orders }, { data: offices }, { data: audit }] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, public_ref, state, state_since, corridor, send_currency, send_amount_minor, receive_currency, receive_amount_minor, sla_target_at, due_at, origin, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("exchange_offices").select("id, status").is("deleted_at", null),
    supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(12),
  ]);

  const rows = (orders ?? []) as Pick<
    Order,
    | "id"
    | "public_ref"
    | "state"
    | "state_since"
    | "corridor"
    | "send_currency"
    | "send_amount_minor"
    | "receive_currency"
    | "receive_amount_minor"
    | "sla_target_at"
    | "due_at"
    | "origin"
    | "created_at"
  >[];

  const byState = new Map<OrderState, number>();
  for (const row of rows) byState.set(row.state, (byState.get(row.state) ?? 0) + 1);

  // GMV is stated in the Toman leg, because that is the leg every corridor has.
  const settled = rows.filter((r) => r.state === "completed");
  const gmvMinor = settled.reduce(
    (sum, r) => sum + (r.send_currency === "IRT" ? r.send_amount_minor : r.receive_amount_minor),
    0,
  );

  const now = Date.now();
  const atRisk = rows.filter(
    (r) =>
      LIVE_STATES.includes(r.state) &&
      r.due_at !== null &&
      new Date(r.due_at).getTime() - now < 24 * 60 * 60 * 1000,
  );

  return (
    <AdminShell
      seats={ctx.seats}
      impersonation={ctx.impersonation}
      office={ctx.impersonatedOffice}
      title={t("title")}
      description={t("subtitle")}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label={t("stats.gmv")}
          value={fromMinor(gmvMinor, "IRT" as CurrencyCode)}
          currency="IRT"
        />
        <StatTile label={t("stats.settled")} value={settled.length} />
        <StatTile
          label={t("stats.live")}
          value={rows.filter((r) => LIVE_STATES.includes(r.state)).length}
        />
        <StatTile
          label={t("stats.atRisk")}
          value={atRisk.length}
          tone={atRisk.length > 0 ? "warn" : "neutral"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <StateBreakdown counts={[...byState.entries()]} total={rows.length} />
        <LiveFeed entries={(audit ?? []) as AuditLogEntry[]} />
      </div>

      <p className="text-sm text-ink-600">
        {t("officeCount", {
          active: (offices ?? []).filter((o) => o.status === "active").length,
          total: (offices ?? []).length,
        })}
      </p>
    </AdminShell>
  );
}
