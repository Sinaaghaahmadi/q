import { ShieldAlert, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import * as React from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  FinanceView,
  type FeeMonth,
  type LedgerTxn,
  type OfficeFee,
  type TrialRow,
  type TxnLine,
} from "@/components/admin/finance-view";
import { EmptyState } from "@/components/layout/empty-state";
import { redirect } from "@/i18n/navigation";
import { getAdminContext } from "@/lib/auth/admin-context";
import { can } from "@/lib/auth/can";
import { gregorianToJalali, jalaliToGregorian } from "@/lib/date/jalali";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { ExchangeOffice, LedgerAccount, LedgerEntry, Order } from "@/lib/supabase/types";

const MONTHS = 12;

/**
 * A trial balance is only true over the whole ledger, so the entries are paged
 * through rather than capped at one query's worth. The ceiling exists so a
 * console page can never turn into an unbounded scan; when it is reached the
 * screen says the balance covers part of the ledger instead of reporting a
 * boundary-cut transaction as a broken one.
 */
const PAGE = 1000;
const MAX_PAGES = 12;

/** Enough recent transactions to reconcile a shift, not a whole month. */
const RECENT_TXNS = 40;

type LedgerAccountRow = Pick<LedgerAccount, "id" | "owner_type" | "owner_id" | "currency" | "code">;
type OfficeRow = Pick<ExchangeOffice, "id" | "legal_name_fa" | "legal_name_en">;

/**
 * The twelve month boundaries in the calendar the reader keeps books in — the
 * same construction the reports dashboard uses. A fee total bucketed on
 * Gregorian boundaries and labelled in Jalali would disagree with that page by
 * a few days at each edge, and a difference between two admin screens reads as
 * a discrepancy in the ledger rather than in the calendar.
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
  const t = await getTranslations({ locale, namespace: "admin.finance" });
  return { title: t("metaTitle") };
}

export default async function AdminFinancePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin.finance");
  const shell = await getTranslations("admin");

  if (!isSupabaseConfigured()) {
    return (
      <EmptyState
        icon={Wallet}
        hue="brand"
        title={shell("unavailableTitle")}
        description={shell("unavailableBody")}
        ctaLabel={shell("backHome")}
      />
    );
  }

  const ctx = await getAdminContext();
  if (!ctx) redirect({ href: "/signin?next=/admin/finance", locale });
  if (!ctx || !can(ctx.seats, "platform.oversee")) {
    return (
      <EmptyState
        icon={ShieldAlert}
        hue="indigo"
        title={shell("forbiddenTitle")}
        description={shell("forbiddenBody")}
        ctaLabel={shell("backHome")}
      />
    );
  }

  const supabase = await createClient();
  // Retired accounts are read too. An account with entries against it is part of
  // the trial balance whatever its `deleted_at` says; hiding one would drop its
  // position from the grand total and raise a false unbalanced alarm.
  const [{ data: accountRows, error: accountError }, { data: officeRows }] = await Promise.all([
    supabase.from("ledger_accounts").select("id, owner_type, owner_id, currency, code"),
    supabase.from("exchange_offices").select("id, legal_name_fa, legal_name_en"),
  ]);

  // A read that failed and a ledger with nothing in it both arrive as an empty
  // array, and on this page the difference is the whole verdict: one is a
  // balanced ledger, the other is a screen that knows nothing. The failure is
  // carried through to the banner instead of being summed as zero.
  let failed = accountError !== null;

  // Newest first, so a truncated read keeps the transactions this screen shows
  // and loses the oldest history — which the banner then says out loud.
  const entries: LedgerEntry[] = [];
  let truncated = false;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { data, error } = await supabase
      .from("ledger_entries")
      .select("*")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) {
      failed = true;
      break;
    }
    const batch = (data ?? []) as LedgerEntry[];
    entries.push(...batch);
    if (batch.length < PAGE) break;
    truncated = page === MAX_PAGES - 1;
  }

  const accounts = (accountRows ?? []) as LedgerAccountRow[];
  const offices = (officeRows ?? []) as OfficeRow[];
  const officeById = new Map(offices.map((office) => [office.id, office]));
  const accountById = new Map(accounts.map((account) => [account.id, account]));

  const named = (account: LedgerAccountRow | undefined) => {
    const office =
      account?.owner_type === "office" && account.owner_id
        ? officeById.get(account.owner_id)
        : undefined;
    return {
      ownerNameFa: office?.legal_name_fa ?? null,
      ownerNameEn: office?.legal_name_en ?? null,
    };
  };

  // Debits minus credits, the one sign convention this page uses. Both sides of
  // an account are counted because the ledger is append-only: a reversed fee
  // comes back as a debit on the account it was credited to, and taking only
  // the credit side would report income that was handed back.
  const position = new Map<string, { netMinor: number; entries: number }>();
  for (const entry of entries) {
    const held = position.get(entry.ledger_account_id) ?? { netMinor: 0, entries: 0 };
    held.netMinor += entry.direction === "debit" ? entry.amount_minor : -entry.amount_minor;
    held.entries += 1;
    position.set(entry.ledger_account_id, held);
  }

  const rows: TrialRow[] = accounts.map((account) => {
    const held = position.get(account.id);
    return {
      id: account.id,
      ownerType: account.owner_type,
      ownerId: account.owner_id,
      ...named(account),
      code: account.code,
      currency: account.currency,
      netMinor: held?.netMinor ?? 0,
      entries: held?.entries ?? 0,
    };
  });

  const starts = monthStarts(locale, new Date());
  const bounds = starts.map((start) => start.getTime());
  const bucketOf = (at: number) => {
    for (let index = bounds.length - 1; index >= 0; index -= 1) {
      if (at >= (bounds[index] ?? 0)) return index;
    }
    return -1;
  };

  // Fee revenue is stated in Toman only. A fee held in another currency would
  // have to be converted at some past month's rate to join this total, and a
  // report that guesses a rate is worse than one that leaves the row out.
  const platformFeeAccounts = new Set(
    accounts
      .filter((a) => a.owner_type === "platform" && a.code === "irt_fees" && a.currency === "IRT")
      .map((a) => a.id),
  );
  const officeFeeAccounts = new Map(
    accounts
      .filter((a) => a.owner_type === "office" && a.code === "irt_fees" && a.currency === "IRT")
      .map((a) => [a.id, a.owner_id]),
  );

  const months: FeeMonth[] = starts.map((start) => ({
    start: start.toISOString(),
    netMinor: 0,
  }));
  const officeTotals = new Map<string, number>();

  for (const entry of entries) {
    const bucket = months[bucketOf(Date.parse(entry.created_at))];
    if (!bucket) continue;
    const signed = entry.direction === "credit" ? entry.amount_minor : -entry.amount_minor;
    if (platformFeeAccounts.has(entry.ledger_account_id)) {
      bucket.netMinor += signed;
      continue;
    }
    const officeId = officeFeeAccounts.get(entry.ledger_account_id);
    if (officeId) officeTotals.set(officeId, (officeTotals.get(officeId) ?? 0) + signed);
  }

  const officeFees: OfficeFee[] = [...officeTotals]
    .map(([officeId, netMinor]) => ({
      officeId,
      nameFa: officeById.get(officeId)?.legal_name_fa ?? null,
      nameEn: officeById.get(officeId)?.legal_name_en ?? null,
      netMinor,
    }))
    .sort((a, b) => b.netMinor - a.netMinor);

  // Entries arrive newest first, so the order the transaction ids are first
  // seen in is already the order they belong on screen.
  const order: string[] = [];
  const byTxn = new Map<string, LedgerEntry[]>();
  for (const entry of entries) {
    const held = byTxn.get(entry.txn_id);
    if (held) held.push(entry);
    else {
      byTxn.set(entry.txn_id, [entry]);
      order.push(entry.txn_id);
    }
  }

  const recentIds = order.slice(0, RECENT_TXNS);
  const orderIds = [
    ...new Set(
      recentIds.flatMap((id) =>
        (byTxn.get(id) ?? []).map((entry) => entry.order_id).filter((v): v is string => v !== null),
      ),
    ),
  ];

  let refs: Pick<Order, "id" | "public_ref">[] = [];
  if (orderIds.length > 0) {
    const { data } = await supabase.from("orders").select("id, public_ref").in("id", orderIds);
    refs = data ?? [];
  }
  const refById = new Map(refs.map((row) => [row.id, row.public_ref]));

  const txns: LedgerTxn[] = recentIds.map((txnId) => {
    const lines = byTxn.get(txnId) ?? [];
    const orderId = lines.find((entry) => entry.order_id !== null)?.order_id ?? null;
    const rendered: TxnLine[] = lines.map((entry) => {
      const account = accountById.get(entry.ledger_account_id);
      return {
        id: entry.id,
        direction: entry.direction,
        amount_minor: entry.amount_minor,
        currency: entry.currency,
        memo: entry.memo,
        code: account?.code ?? entry.ledger_account_id.slice(0, 8),
        // An account this page could not read is left unattributed. Filing it
        // under suspense would name a group on the strength of a missing row,
        // on the one screen whose job is saying whose money this is.
        ownerType: account?.owner_type ?? null,
        ownerId: account?.owner_id ?? null,
        ...named(account),
        // `post_order_refund` prefixes every compensating entry it writes, so
        // the memo is the record of what a line is, not a guess about it.
        reversal: entry.memo?.startsWith("reversal:") ?? false,
      };
    });
    return {
      id: txnId,
      at: lines[0]?.created_at ?? new Date().toISOString(),
      orderId,
      orderRef: orderId ? (refById.get(orderId) ?? null) : null,
      reversal: rendered.some((line) => line.reversal),
      lines: rendered,
    };
  });

  return (
    <AdminShell
      seats={ctx.seats}
      impersonation={ctx.impersonation}
      office={ctx.impersonatedOffice}
      title={t("title")}
      description={t("subtitle")}
    >
      <FinanceView
        rows={rows}
        months={months}
        officeFees={officeFees}
        txns={txns}
        scanned={entries.length}
        truncated={truncated}
        failed={failed}
      />
    </AdminShell>
  );
}
