"use client";

import { CircleAlert, Eye, Power, Save } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import * as React from "react";
import { PanelSection } from "@/components/layout/panel-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatAmount, type AppLocale } from "@/lib/money/format";
import { fromMinor } from "@/lib/money/minor";
import type { CurrencyCode } from "@/lib/rates/catalog";
import { createClient } from "@/lib/supabase/client";
import type {
  ExchangeOffice,
  Json,
  OfficeAccount,
  OfficeBalance,
  OfficeRateConfig,
} from "@/lib/supabase/types";

const STATUS_TONE = {
  draft: "neutral",
  active: "up",
  suspended: "warn",
  archived: "down",
} as const;

type Defaults = { rate_config?: { corridor?: string; spread_bps?: number }[] };

/**
 * §16.2: override any default this office inherited, and see at a glance where
 * it differs from the platform template. Spreads write straight to
 * `office_rate_config` — the RLS policy already admits a platform admin, and
 * the audit trigger records the before/after — so there is no bespoke RPC in
 * the way of a two-field edit.
 */
export function OfficeConfig({
  office,
  accounts,
  rates,
  balances,
  defaults,
  orderCount,
  canImpersonate,
  impersonatingHere,
}: {
  office: ExchangeOffice;
  accounts: OfficeAccount[];
  rates: OfficeRateConfig[];
  balances: OfficeBalance[];
  defaults: Json | null;
  orderCount: number;
  canImpersonate: boolean;
  impersonatingHere: boolean;
}) {
  const t = useTranslations("admin.exchanges");
  const locale = useLocale() as AppLocale;
  const router = useRouter();

  const template = ((defaults ?? {}) as Defaults).rate_config ?? [];
  const baseline = new Map(template.map((r) => [r.corridor ?? "", r.spread_bps ?? 0]));

  const [spreads, setSpreads] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(rates.map((r) => [r.id, String(r.spread_bps)])),
  );
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<string | null>(null);

  async function saveSpread(row: OfficeRateConfig) {
    const next = Number(spreads[row.id]);
    if (!Number.isFinite(next) || next < 0 || next > 2000) {
      setError(t("errors.spreadRange"));
      return;
    }
    setBusy(row.id);
    setError(null);
    const supabase = createClient();
    const { error: dbError } = await supabase
      .from("office_rate_config")
      .update({ spread_bps: next })
      .eq("id", row.id);
    setBusy(null);
    if (dbError) {
      setError(t("errors.saveFailed"));
      return;
    }
    setNote(t("saved"));
    router.refresh();
  }

  async function setStatus(status: string) {
    setBusy("status");
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("admin_set_office_status", {
      p_office: office.id,
      p_status: status,
      p_reason: reason.trim() || null,
    });
    setBusy(null);
    if (rpcError) {
      setError(
        /written reason/i.test(rpcError.message)
          ? t("errors.reasonRequired")
          : /public settlement account/i.test(rpcError.message)
            ? t("errors.noAccount")
            : t("errors.saveFailed"),
      );
      return;
    }
    setReason("");
    router.refresh();
  }

  async function impersonate() {
    setBusy("impersonate");
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("impersonation_start", {
      p_office: office.id,
      p_reason: reason.trim(),
      p_minutes: 30,
    });
    setBusy(null);
    if (rpcError) {
      setError(
        /written reason/i.test(rpcError.message)
          ? t("errors.reasonRequired")
          : /only a platform superadmin/i.test(rpcError.message)
            ? t("errors.superadminOnly")
            : t("errors.saveFailed"),
      );
      return;
    }
    router.push("/office");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={STATUS_TONE[office.status]}>{t(`status.${office.status}`)}</Badge>
        <span className="text-sm text-ink-600">{t("liveOrders", { count: orderCount })}</span>
      </div>

      <PanelSection title={t("reasonTitle")} hint={t("reasonHint")} bodyClassName="space-y-3">
        <p className="text-sm text-ink-600">{t("reasonBody")}</p>
        <Input
          aria-label={t("reasonTitle")}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t("reasonPlaceholder")}
        />
        <div className="flex flex-wrap gap-2">
          {office.status !== "active" ? (
            <Button disabled={busy !== null} onClick={() => setStatus("active")}>
              <Power className="size-4" aria-hidden />
              {t("activate")}
            </Button>
          ) : (
            <Button
              variant="secondary"
              disabled={busy !== null || reason.trim().length < 8}
              onClick={() => setStatus("suspended")}
            >
              <Power className="size-4" aria-hidden />
              {t("suspend")}
            </Button>
          )}
          {canImpersonate ? (
            <Button
              variant="soft"
              disabled={busy !== null || reason.trim().length < 8 || impersonatingHere}
              onClick={impersonate}
            >
              <Eye className="size-4" aria-hidden />
              {impersonatingHere ? t("alreadyImpersonating") : t("impersonate")}
            </Button>
          ) : null}
        </div>
      </PanelSection>

      <PanelSection title={t("spreads")} hint={t("spreadsHint")} bodyClassName="space-y-3">
        {rates.length === 0 ? (
          <p className="text-sm text-ink-600">{t("noCorridors")}</p>
        ) : (
          rates.map((row) => {
            const base = baseline.get(row.corridor);
            const overridden = base !== undefined && base !== row.spread_bps;
            return (
              <div key={row.id} className="flex flex-wrap items-end gap-2">
                <span className="w-28 font-mono text-sm" dir="ltr">
                  {row.corridor}
                </span>
                <label className="w-28 text-sm">
                  <span className="sr-only">{t("spreadBps")}</span>
                  <Input
                    dir="ltr"
                    inputMode="numeric"
                    value={spreads[row.id] ?? ""}
                    onChange={(e) => setSpreads((s) => ({ ...s, [row.id]: e.target.value }))}
                  />
                </label>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy !== null || spreads[row.id] === String(row.spread_bps)}
                  onClick={() => saveSpread(row)}
                >
                  <Save className="size-4" aria-hidden />
                  {t("save")}
                </Button>
                {overridden ? (
                  <Badge variant="info">{t("overridden", { base: base ?? 0 })}</Badge>
                ) : (
                  <Badge variant="outline">{t("fromTemplate")}</Badge>
                )}
              </div>
            );
          })
        )}
      </PanelSection>

      <div className="grid gap-4 sm:grid-cols-2">
        <PanelSection
          title={t("accounts")}
          hint={t("accountsHint")}
          href="/admin/settlement"
          linkLabel={t("openSettlement")}
        >
          {accounts.length === 0 ? (
            <p className="text-sm text-ink-600">{t("noAccounts")}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {accounts.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3">
                  <span className="font-mono" dir="ltr">
                    {a.currency} · {t(`kind.${a.kind}`)}
                  </span>
                  <span className="truncate text-ink-600" dir="ltr">
                    {accountNumber(a.details)}
                  </span>
                  {a.is_public ? <Badge variant="up">{t("publicAccount")}</Badge> : null}
                </li>
              ))}
            </ul>
          )}
        </PanelSection>

        <PanelSection
          title={t("balances")}
          hint={t("balancesHint")}
          href="/admin/finance"
          linkLabel={t("openLedger")}
        >
          {balances.length === 0 ? (
            <p className="text-sm text-ink-600">{t("noBalances")}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {balances.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3">
                  <span className="font-mono" dir="ltr">
                    {b.currency}
                  </span>
                  <span className="tabular-nums">
                    {formatAmount(
                      fromMinor(b.available_minor, b.currency as CurrencyCode),
                      b.currency as CurrencyCode,
                      locale,
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </PanelSection>
      </div>

      {error ? (
        <p className="flex items-start gap-1.5 text-sm text-down">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}
      {note && !error ? <p className="text-sm text-up">{note}</p> : null}
    </div>
  );
}

function accountNumber(details: Json): string {
  if (details && typeof details === "object" && !Array.isArray(details)) {
    const value = details.number ?? details.iban ?? details.card;
    if (typeof value === "string") return value;
  }
  return "—";
}
