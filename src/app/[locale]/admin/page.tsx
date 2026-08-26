import {
  AlertTriangle,
  Banknote,
  BadgeCheck,
  Clock,
  Coins,
  Gavel,
  LifeBuoy,
  ShieldAlert,
  TicketCheck,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import * as React from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { Attention, type AttentionItem } from "@/components/admin/attention";
import { LiveFeed } from "@/components/admin/live-feed";
import { MetricTile } from "@/components/admin/metric-tile";
import { OfficeScorecards, type OfficeScore } from "@/components/admin/office-scorecards";

import { StateBreakdown } from "@/components/admin/state-breakdown";
import {
  CorridorMix,
  VolumeChart,
  type CorridorSlice,
  type MonthBar,
} from "@/components/admin/volume-chart";
import { EmptyState } from "@/components/layout/empty-state";
import { redirect } from "@/i18n/navigation";
import { getAdminContext } from "@/lib/auth/admin-context";
import { can } from "@/lib/auth/can";
import { gregorianToJalali, jalaliToGregorian } from "@/lib/date/jalali";
import { formatAmount, formatDate, formatNumber, type AppLocale } from "@/lib/money/format";
import { fromMinor } from "@/lib/money/minor";
import { isTerminal } from "@/lib/orders/flow";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type {
  AuditLogEntry,
  ExchangeOffice,
  LedgerEntry,
  Order,
  OrderEvent,
  OrderState,
} from "@/lib/supabase/types";

const MONTHS = 12;
const DAY_MS = 86_400_000;

/** The columns a report needs; the rest of an order is not read for a total. */
type ReportLeg = Pick<
  Order,
  | "id"
  | "office_id"
  | "corridor"
  | "state"
  | "send_currency"
  | "send_amount_minor"
  | "receive_amount_minor"
  | "due_at"
  | "created_at"
>;

/** Every total is stated in Toman, because that is the leg every corridor has. */
function tomanMinor(order: ReportLeg): number {
  return order.send_currency === "IRT" ? order.send_amount_minor : order.receive_amount_minor;
}

/**
 * The twelve month boundaries, in the calendar the reader keeps books in.
 *
 * A Persian desk closes its month on the last of Esfand, not on 31 December, so
 * bucketing into Gregorian months and then printing a Jalali label would put
 * the wrong number under every bar. The boundaries are built in the display
 * calendar instead, and each label is simply that bucket's own first day.
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
  const t = await getTranslations({ locale, namespace: "admin.dashboard" });
  return { title: t("metaTitle") };
}

export default async function AdminHomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin.dashboard");
  const shell = await getTranslations("admin");
  const fmt = locale as AppLocale;

  if (!isSupabaseConfigured()) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title={shell("unavailableTitle")}
        description={shell("unavailableBody")}
        ctaLabel={shell("backHome")}
      />
    );
  }

  const ctx = await getAdminContext();
  if (!ctx) redirect({ href: "/signin?next=/admin", locale });
  if (!ctx || !can(ctx.seats, "platform.oversee")) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title={shell("forbiddenTitle")}
        description={shell("forbiddenBody")}
        ctaLabel={shell("backHome")}
      />
    );
  }

  const now = new Date();
  const starts = monthStarts(locale, now);
  const windowStart = starts[0] ?? now;
  const thisMonthStart = starts[MONTHS - 1] ?? windowStart;
  const lastMonthStart = starts[MONTHS - 2] ?? windowStart;

  // `platform.oversee` reaches wider than the audit_log policy does: a support
  // seat passes the gate on this page but the policy admits only admin,
  // superadmin and compliance. RLS filters rows instead of raising, so asking
  // anyway would hand back an empty array and the feed would state that nothing
  // has happened — a claim about the log, where the truth is "not yours to read".
  const mayAudit = can(ctx.seats, "platform.audit");

  const supabase = await createClient();
  const [
    { data: orderRows },
    { data: officeRows },
    { data: eventRows },
    { data: accountRows },
    auditResult,
  ] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, office_id, corridor, state, send_currency, send_amount_minor, receive_amount_minor, due_at, created_at",
      )
      .is("deleted_at", null)
      .gte("created_at", windowStart.toISOString())
      .order("created_at", { ascending: false })
      .limit(4000),
    supabase
      .from("exchange_offices")
      .select("id, legal_name_fa, legal_name_en, status")
      .is("deleted_at", null),
    // Two transitions out of the whole timeline: the one that settles an order
    // and the one that disputes it. Pulling a year of events to recover two
    // timestamps per order is the difference between a page and a batch job.
    supabase
      .from("order_events")
      .select("order_id, to_state, created_at")
      .in("to_state", ["completed", "disputed"])
      .gte("created_at", windowStart.toISOString())
      .limit(8000),
    supabase
      .from("ledger_accounts")
      .select("id, currency")
      .eq("owner_type", "platform")
      .eq("code", "irt_fees"),
    mayAudit
      ? supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(12)
      : null,
  ]);

  /*
   * The queues, as counts.
   *
   * `head: true` with `count: "exact"` asks Postgres for the number and returns
   * no rows — the panel needs "seven waiting", never the seven. Each is still
   * filtered by row-level security, so a seat that cannot see a table gets zero
   * rather than an error, which is the correct reading here: nothing in it is
   * theirs to act on.
   */
  const [kycWaiting, ticketsOpen, officesPending, coinsWaiting] = await Promise.all([
    supabase
      .from("kyc_submissions")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .is("deleted_at", null)
      .then(({ count }) => count ?? 0),
    supabase
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      // `state`, not `status`, and the three that are somebody's to answer:
      // `waiting_user` is the customer's turn, and counting it here would
      // report work that is not ours as work we owe.
      .in("state", ["open", "in_progress", "escalated"])
      .is("deleted_at", null)
      .then(({ count }) => count ?? 0),
    supabase
      .from("exchange_offices")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .neq("status", "active")
      .then(({ count }) => count ?? 0),
    supabase
      .from("coin_orders")
      .select("id", { count: "exact", head: true })
      .eq("state", "requested")
      .is("deleted_at", null)
      .then(({ count }) => count ?? 0),
  ]);

  const orders = (orderRows ?? []) as ReportLeg[];
  const offices = (officeRows ?? []) as Pick<
    ExchangeOffice,
    "id" | "legal_name_fa" | "legal_name_en" | "status"
  >[];
  const events = (eventRows ?? []) as Pick<OrderEvent, "order_id" | "to_state" | "created_at">[];

  // The order row only remembers the state it is in now. When it settled, and
  // whether it was ever argued over, live in the event log — which is also the
  // record the office panel and the customer timeline read, so the three
  // screens cannot drift apart.
  const settledAt = new Map<string, number>();
  const disputed = new Set<string>();
  for (const event of events) {
    if (event.to_state === "completed") settledAt.set(event.order_id, Date.parse(event.created_at));
    else disputed.add(event.order_id);
  }

  // Platform fee revenue is a Toman figure, so only the IRT fee account is
  // summed; converting a fee held in another currency would mean picking a rate
  // for a past month, and a report that guesses is worse than one that omits.
  const feeAccountIds = (accountRows ?? [])
    .filter((account) => account.currency === "IRT")
    .map((account) => account.id);

  let feeEntries: Pick<LedgerEntry, "amount_minor" | "direction" | "created_at">[] = [];
  if (feeAccountIds.length > 0) {
    const { data } = await supabase
      .from("ledger_entries")
      .select("amount_minor, direction, created_at")
      .in("ledger_account_id", feeAccountIds)
      .gte("created_at", lastMonthStart.toISOString());
    feeEntries = data ?? [];
  }

  // Every month-over-month figure on this page compares the month in progress
  // against the same number of days into last month, never against a complete
  // one. On the second of Mehr a full Shahrivar baseline prints a ninety-percent
  // collapse in volume, fees and settled orders alike, every single month.
  const elapsed = now.getTime() - thisMonthStart.getTime();
  // Which day of the month it is, in the reader's calendar. Three of the cards
  // count only the month in progress, and on the first of Shahrivar that is a
  // few hours of trading — the tiles read zero while the chart underneath still
  // shows all of Mordad, and nothing on the page said why. Stating the span is
  // the difference between "we settled nothing" and "the month is one day old".
  const dayOfMonth = Math.floor(elapsed / DAY_MS) + 1;
  const inSameSpanLastMonth = (at: number) =>
    at >= lastMonthStart.getTime() &&
    at < thisMonthStart.getTime() &&
    at - lastMonthStart.getTime() <= elapsed;

  // Net of debits, not gross credits: the ledger is append-only, so a reversed
  // fee comes back as a debit on the same account. Counting only the credit
  // side would have the platform reporting income it handed back.
  let feesThisMonth = 0;
  let feesLastMonth = 0;
  for (const entry of feeEntries) {
    const at = Date.parse(entry.created_at);
    const signed = entry.direction === "credit" ? entry.amount_minor : -entry.amount_minor;
    if (at >= thisMonthStart.getTime()) feesThisMonth += signed;
    else if (inSameSpanLastMonth(at)) feesLastMonth += signed;
  }

  const bounds = starts.map((start) => start.getTime());
  const bucketOf = (at: number) => {
    for (let index = bounds.length - 1; index >= 0; index -= 1) {
      if (at >= (bounds[index] ?? 0)) return index;
    }
    return -1;
  };

  // Volume is bucketed by when an order settled rather than when it was opened:
  // "how much did we move in Mehr" is a question about money that landed, and
  // an order opened in Shahrivar spends its Toman in Mehr all the same.
  const months: MonthBar[] = starts.map((start) => ({
    start: start.toISOString(),
    volumeMinor: 0,
    settled: 0,
  }));
  let previousVolumeMinor = 0;
  let previousSettled = 0;
  for (const order of orders) {
    const at = settledAt.get(order.id);
    if (order.state !== "completed" || at === undefined) continue;
    const bar = months[bucketOf(at)];
    if (!bar) continue;
    bar.volumeMinor += tomanMinor(order);
    bar.settled += 1;
    if (inSameSpanLastMonth(at)) {
      previousVolumeMinor += tomanMinor(order);
      previousSettled += 1;
    }
  }

  const thisMonth = months[MONTHS - 1];

  // One definition of open, shared by both counts. Anything still able to move
  // is open, minus the drafts nobody has handed us yet; on_hold, info_needed and
  // disputed belong here too, because the Toman is already funded and a customer
  // is waiting on all three. Two definitions would let "at risk" exceed "in
  // flight" and leave the reader to work out which card meant what.
  const open = orders.filter((order) => !isTerminal(order.state) && order.state !== "draft");

  // `due_at` is written in exactly one place in the product — `p2p_trade_take` —
  // so a marketplace built of remittance orders has nothing to judge. Printing a
  // confident zero there claims every deadline is safe; the card says "no
  // deadline is recorded" instead, which is the fact.
  const graded = open.filter(
    (order): order is ReportLeg & { due_at: string } => order.due_at !== null,
  );
  // An order already past its deadline is the most at-risk thing on the board,
  // so the window has no floor — it is "less than a day left", not "a day left".
  const atRisk =
    graded.length > 0
      ? {
          counted: graded.filter((order) => Date.parse(order.due_at) - now.getTime() < DAY_MS)
            .length,
        }
      : null;

  const byState = new Map<OrderState, number>();
  for (const order of orders) byState.set(order.state, (byState.get(order.state) ?? 0) + 1);

  const byCorridor = new Map<string, number>();
  for (const order of orders) {
    if (order.state !== "completed") continue;
    byCorridor.set(order.corridor, (byCorridor.get(order.corridor) ?? 0) + tomanMinor(order));
  }
  const corridors: CorridorSlice[] = [...byCorridor]
    .map(([corridor, volumeMinor]) => ({ corridor, volumeMinor }))
    .sort((a, b) => b.volumeMinor - a.volumeMinor);

  const handledBy = new Map<string, ReportLeg[]>();
  for (const order of orders) {
    if (!order.office_id) continue;
    const held = handledBy.get(order.office_id);
    if (held) held.push(order);
    else handledBy.set(order.office_id, [order]);
  }

  const scores: OfficeScore[] = offices
    .filter((office) => office.status === "active")
    .map((office) => {
      const handled = handledBy.get(office.id) ?? [];
      const settled = handled.filter(
        (order) => order.state === "completed" && settledAt.has(order.id),
      );
      // The clock starts when the customer opened the order and stops on the
      // event that recorded the settlement, so a row that sat unclaimed for two
      // days counts those two days against the office that eventually took it.
      const durations = settled
        .map((order) => (settledAt.get(order.id) ?? 0) - Date.parse(order.created_at))
        .filter((ms) => ms >= 0);
      const judged = settled.filter(
        (order): order is ReportLeg & { due_at: string } => order.due_at !== null,
      );

      return {
        officeId: office.id,
        nameFa: office.legal_name_fa,
        nameEn: office.legal_name_en,
        orders: handled.length,
        volumeMinor: settled.reduce((sum, order) => sum + tomanMinor(order), 0),
        averageMinutes:
          durations.length > 0
            ? durations.reduce((sum, ms) => sum + ms, 0) / durations.length / 60_000
            : null,
        sla:
          judged.length > 0
            ? {
                measured: judged.length,
                onTime: judged.filter(
                  (order) => (settledAt.get(order.id) ?? 0) <= Date.parse(order.due_at),
                ).length,
              }
            : null,
        disputeRate:
          handled.length > 0
            ? handled.filter((order) => disputed.has(order.id)).length / handled.length
            : null,
      };
    })
    .sort((a, b) => b.volumeMinor - a.volumeMinor);

  const disputedOpen = open.filter((order) => order.state === "disputed").length;

  /*
   * The queues, in the order they should be looked at.
   *
   * Deadlines first because somebody is already waiting past a promise;
   * disputes next because money is frozen while one is open; then the things
   * that are merely somebody's turn. `Attention` drops every zero and prints
   * one line when they are all zero, so this list is the full set of what
   * *could* ask rather than what is asking today.
   */
  const attention: AttentionItem[] = [
    {
      key: "atRisk",
      href: "/admin/orders?risk=1",
      icon: Clock,
      count: atRisk?.counted ?? 0,
      severity: "urgent",
    },
    {
      key: "disputes",
      href: "/admin/orders?state=disputed",
      icon: Gavel,
      count: disputedOpen,
      severity: "urgent",
    },
    { key: "kyc", href: "/admin/kyc", icon: BadgeCheck, count: kycWaiting, severity: "waiting" },
    {
      key: "tickets",
      href: "/admin/tickets",
      icon: TicketCheck,
      count: ticketsOpen,
      severity: "waiting",
    },
    {
      key: "coins",
      href: "/admin/orders?state=matching",
      icon: Coins,
      count: coinsWaiting,
      severity: "waiting",
    },
    {
      key: "offices",
      href: "/admin/exchanges",
      icon: LifeBuoy,
      count: officesPending,
      severity: "info",
    },
  ];

  const pct = (current: number, previous: number) =>
    previous > 0 ? ((current - previous) / previous) * 100 : null;

  const tomanOf = (minor: number) => formatAmount(fromMinor(minor, "IRT"), "IRT", fmt);
  const countOf = (value: number) => formatNumber(value, fmt, { maximumFractionDigits: 0 });

  const monthToDate = t("monthToDate", {
    month: formatDate(thisMonthStart.toISOString(), fmt, { month: "long" }),
    days: dayOfMonth,
  });

  return (
    <AdminShell
      seats={ctx.seats}
      impersonation={ctx.impersonation}
      office={ctx.impersonatedOffice}
      title={t("title")}
      description={t("subtitle")}
    >
      <Attention items={attention} />

      {/* Four tiles in one row, not five in a ragged three-and-two. The fifth
          figure — settled count — belongs to volume and rides with it. */}
      <section aria-label={t("kpiLabel")} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          icon={<TrendingUp className="size-4" aria-hidden />}
          label={t("card.volume")}
          href="/admin/orders?state=completed"
          value={tomanOf(thisMonth?.volumeMinor ?? 0)}
          unit={t("toman")}
          delta={pct(thisMonth?.volumeMinor ?? 0, previousVolumeMinor)}
          trend={months.map((month) => month.volumeMinor)}
          hint="openMarket"
          footnote={monthToDate}
        />
        <MetricTile
          icon={<Wallet className="size-4" aria-hidden />}
          label={t("card.fees")}
          href="/admin/finance"
          value={tomanOf(feesThisMonth)}
          unit={t("toman")}
          delta={pct(feesThisMonth, feesLastMonth)}
          hint="commission"
          footnote={monthToDate}
        />
        <MetricTile
          icon={<Banknote className="size-4" aria-hidden />}
          label={t("card.settled")}
          href="/admin/orders?state=completed"
          value={countOf(thisMonth?.settled ?? 0)}
          delta={pct(thisMonth?.settled ?? 0, previousSettled)}
          trend={months.map((month) => month.settled)}
          footnote={monthToDate}
        />
        <MetricTile
          icon={<AlertTriangle className="size-4" aria-hidden />}
          label={t("card.inFlight")}
          href="/admin/orders"
          value={countOf(open.length)}
          tone={atRisk && atRisk.counted > 0 ? "risk" : "neutral"}
          hint="sla"
          footnote={
            atRisk
              ? t("card.atRiskOf", { counted: countOf(atRisk.counted) })
              : t("card.noDeadlines")
          }
          /* Only when there is something to open. A link to an empty list is
             a dead end dressed as a lead. */
          footnoteHref={atRisk && atRisk.counted > 0 ? "/admin/orders?risk=1" : undefined}
        />
      </section>

      {/* Two columns from `xl`: the trend and the mix are read together, and
          stacking every panel made the console 2,000 pixels tall to say six
          things. */}
      <div className="grid items-start gap-4 xl:grid-cols-2">
        <VolumeChart months={months} />
        <CorridorMix corridors={corridors} />
      </div>

      <OfficeScorecards scores={scores} />

      <div
        className={
          mayAudit ? "grid items-start gap-4 xl:grid-cols-[3fr_2fr]" : "grid items-start gap-4"
        }
      >
        <StateBreakdown counts={[...byState.entries()]} total={orders.length} />
        {mayAudit ? <LiveFeed entries={(auditResult?.data ?? []) as AuditLogEntry[]} /> : null}
      </div>
    </AdminShell>
  );
}
