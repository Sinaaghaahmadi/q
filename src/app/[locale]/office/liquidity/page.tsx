import { Building2, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import * as React from "react";
import { MaintenanceScene, NoAccessScene } from "@/components/brand/scenes/states";
import { EmptyState } from "@/components/layout/empty-state";
import { LiquidityView, type LedgerPosition } from "@/components/office/liquidity-view";
import { OfficeShell } from "@/components/office/office-shell";
import { redirect } from "@/i18n/navigation";
import { isPlatformStaff, officeScopes } from "@/lib/auth/can";
import { createClient, getSessionProfile, isSupabaseConfigured } from "@/lib/supabase/server";
import type { AppRole, ExchangeOffice, LedgerEntry } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

/** The seats `office_balances_scoped` names. An operator is deliberately not one. */
const MONEY_ROLES: AppRole[] = ["office_finance", "office_owner", "office_viewer"];

/**
 * The ledger is read in pages for the same reason /admin/finance does it: a
 * position summed from whatever one PostgREST response happened to hold is a
 * wrong number presented as a right one. The ceiling keeps a panel page from
 * becoming an unbounded scan, and reaching it is said out loud on screen.
 */
const PAGE = 1000;
const MAX_PAGES = 24;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "officePanel.money" });
  return { title: t("liquidity.metaTitle") };
}

export default async function OfficeLiquidityPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("officePanel");
  const tm = await getTranslations("officePanel.money");

  if (!isSupabaseConfigured()) {
    return (
      <EmptyState
        icon={Building2}
        scene={MaintenanceScene}
        title={t("unavailableTitle")}
        description={t("unavailableBody")}
        ctaLabel={t("backHome")}
      />
    );
  }

  const session = await getSessionProfile();
  if (!session?.user) {
    redirect({ href: "/signin?next=/office/liquidity", locale });
  }

  const seats = session?.memberships ?? [];
  const officeId = officeScopes(seats)[0];
  if (!officeId) {
    return (
      <EmptyState
        icon={Building2}
        scene={NoAccessScene}
        title={t("notAMemberTitle")}
        description={t("notAMemberBody")}
        ctaLabel={t("backHome")}
      />
    );
  }

  // The nav offers this page to every seat, but the balance policy admits only
  // finance, owner and viewer. Without this check an operator's RLS-filtered
  // empty read would be printed as "the office has no money", which is a claim
  // about the office rather than about the seat reading it.
  const staff = isPlatformStaff(seats);
  const mayRead =
    staff || seats.some((s) => s.scope_id === officeId && MONEY_ROLES.includes(s.role));
  if (!mayRead) {
    return (
      <EmptyState
        icon={ShieldAlert}
        scene={NoAccessScene}
        title={tm("liquidity.noAccessTitle")}
        description={tm("liquidity.noAccessBody")}
        ctaLabel={t("backHome")}
      />
    );
  }

  const supabase = await createClient();
  // `office_balances.available_minor` / `reserved_minor` are written once, at
  // provisioning, and by nothing since — so the rows are read for the set of
  // currencies this office deals in, and the amounts are left alone rather than
  // shown as a hard zero the order flow never moves.
  const [{ data: office }, { data: balanceRows }] = await Promise.all([
    supabase.from("exchange_offices").select("*").eq("id", officeId).maybeSingle(),
    supabase
      .from("office_balances")
      .select("currency")
      .eq("office_id", officeId)
      .is("deleted_at", null)
      .order("currency"),
  ]);

  // `ledger_accounts` and `ledger_entries` carry staff-only select policies, so
  // an office seat's read returns nothing however many entries its orders have
  // posted. Skipping the read keeps the page from reporting a filter as a fact.
  const positions: LedgerPosition[] = [];
  let truncated = false;
  if (staff) {
    const { data: ledgerAccounts } = await supabase
      .from("ledger_accounts")
      .select("id, currency, code")
      .eq("owner_type", "office")
      .eq("owner_id", officeId)
      .is("deleted_at", null);

    const meta = new Map((ledgerAccounts ?? []).map((a) => [a.id, a]));
    if (meta.size > 0) {
      const entries: Pick<LedgerEntry, "ledger_account_id" | "direction" | "amount_minor">[] = [];
      const ids = [...meta.keys()];
      // Newest first, so a truncated read loses the oldest history rather than
      // an arbitrary slice.
      for (let page = 0; page < MAX_PAGES; page += 1) {
        const { data } = await supabase
          .from("ledger_entries")
          .select("ledger_account_id, direction, amount_minor")
          .in("ledger_account_id", ids)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(page * PAGE, page * PAGE + PAGE - 1);
        const batch = data ?? [];
        entries.push(...batch);
        if (batch.length < PAGE) break;
        truncated = page === MAX_PAGES - 1;
      }

      const nets = new Map<string, number>();
      for (const entry of entries) {
        const account = meta.get(entry.ledger_account_id);
        if (!account) continue;
        const key = `${account.currency} ${account.code}`;
        // Credit-positive, the opposite of the admin trial balance. An office
        // account is credited by every fee and settlement and debited only by a
        // reversal, so debit-minus-credit would show an office that has worked
        // all month a large negative number under «تسویه».
        const signed = entry.direction === "credit" ? entry.amount_minor : -entry.amount_minor;
        nets.set(key, (nets.get(key) ?? 0) + signed);
      }

      for (const [key, netMinor] of nets) {
        const [currency = "", code = ""] = key.split(" ");
        positions.push({ currency, code, netMinor });
      }
    }
  }

  const currencies = [
    ...new Set([
      ...(balanceRows ?? []).map((b) => b.currency),
      ...positions.map((p) => p.currency),
    ]),
  ].sort();

  return (
    <OfficeShell
      office={(office ?? null) as ExchangeOffice | null}
      locale={locale}
      title={tm("liquidity.title")}
      description={tm("liquidity.subtitle")}
    >
      <LiquidityView
        currencies={currencies}
        positions={positions}
        ledgerVisible={staff}
        truncated={truncated}
      />
    </OfficeShell>
  );
}
