"use client";

import { CircleAlert, Info, Plus, Save, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { CURRENCY_CODES } from "@/lib/rates/catalog";
import { createClient } from "@/lib/supabase/client";
import type { Json, OfficeAccount } from "@/lib/supabase/types";

type AccountKind = OfficeAccount["kind"];

const KINDS: AccountKind[] = ["iban", "card", "swift", "cash"];

/**
 * The office's own settlement accounts (§4.2).
 *
 * These writes go straight at the table: `office_accounts_manage` already
 * admits office_finance and office_owner, so an RPC in front of them would
 * decide nothing the policy has not decided. `canManage` only keeps the
 * controls off the screen for an operator or viewer, whose UPDATE the database
 * would refuse anyway.
 *
 * There is no delete, because a trigger forbids it — an account customers have
 * paid into may never vanish from the audit trail. Deactivating is the closest
 * true thing, and the copy says so rather than leaving a missing button to be
 * read as an oversight.
 */
export function AccountsEditor({
  officeId,
  accounts,
  canManage,
}: {
  officeId: string;
  accounts: OfficeAccount[];
  canManage: boolean;
}) {
  const t = useTranslations("officePanel.money");
  const router = useRouter();

  const [drafts, setDrafts] = React.useState<Record<string, { number: string; label: string }>>({});
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<string | null>(null);

  const [currency, setCurrency] = React.useState<string>("IRT");
  const [kind, setKind] = React.useState<AccountKind>("card");
  const [newNumber, setNewNumber] = React.useState("");
  const [newLabel, setNewLabel] = React.useState("");

  // Two different gates, and telling the operator only about the harsher one is
  // how this banner came to overstate: `admin_set_office_status` refuses to
  // activate an office with no public, active account in any currency, while it
  // is only P2P escrow routing that asks for a Toman one.
  const hasPublicAccount = accounts.some((a) => a.is_public && a.active);
  const hasPublicIrt = accounts.some((a) => a.currency === "IRT" && a.is_public && a.active);

  function draftOf(account: OfficeAccount) {
    return (
      drafts[account.id] ?? {
        number: accountNumber(account.details),
        label: account.label ?? "",
      }
    );
  }

  async function saveRow(account: OfficeAccount) {
    const draft = draftOf(account);
    const number = draft.number.trim();
    if (number.length < 3) {
      setError(t("accounts.errors.numberRequired"));
      return;
    }
    setBusy(account.id);
    setError(null);
    const supabase = createClient();
    const { error: dbError } = await supabase
      .from("office_accounts")
      .update({
        details: { ...detailsObject(account.details), number },
        label: draft.label.trim() || null,
      })
      .eq("id", account.id);
    setBusy(null);
    if (dbError) {
      setError(t("accounts.errors.saveFailed"));
      return;
    }
    setNote(t("accounts.saved"));
    router.refresh();
  }

  async function toggle(account: OfficeAccount, field: "is_public" | "active", value: boolean) {
    setBusy(account.id);
    setError(null);
    const supabase = createClient();
    const patch: Partial<OfficeAccount> =
      field === "is_public" ? { is_public: value } : { active: value };
    const { error: dbError } = await supabase
      .from("office_accounts")
      .update(patch)
      .eq("id", account.id);
    setBusy(null);
    if (dbError) {
      // The switch is only on screen for a seat that may write, so a refusal
      // here is far more likely to be the network than the policy.
      setError(
        dbError.code === "42501" ? t("accounts.errors.forbidden") : t("accounts.errors.saveFailed"),
      );
      return;
    }
    router.refresh();
  }

  async function add() {
    const number = newNumber.trim();
    if (number.length < 3) {
      setError(t("accounts.errors.numberRequired"));
      return;
    }
    setBusy("new");
    setError(null);
    const supabase = createClient();
    const { error: dbError } = await supabase.from("office_accounts").insert({
      office_id: officeId,
      currency,
      kind,
      details: { number },
      is_public: true,
      active: true,
      label: newLabel.trim() || null,
    });
    setBusy(null);
    if (dbError) {
      setError(t("accounts.errors.saveFailed"));
      return;
    }
    setNewNumber("");
    setNewLabel("");
    setNote(t("accounts.saved"));
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {!hasPublicAccount ? (
        <div className="flex items-start gap-2.5 rounded-xl bg-warn/12 p-4 text-sm text-warn-ink">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            <span className="block font-semibold">{t("accounts.noPublicTitle")}</span>
            <span className="mt-1 block leading-relaxed">{t("accounts.noPublicBody")}</span>
          </span>
        </div>
      ) : !hasPublicIrt ? (
        <div className="flex items-start gap-2.5 rounded-xl bg-info/12 p-4 text-sm text-info-ink">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            <span className="block font-semibold">{t("accounts.noIrtTitle")}</span>
            <span className="mt-1 block leading-relaxed">{t("accounts.noIrtBody")}</span>
          </span>
        </div>
      ) : null}

      <p className="text-sm leading-relaxed text-ink-600">{t("accounts.noDeleteNote")}</p>
      {!canManage ? <p className="text-sm text-ink-600">{t("accounts.readOnly")}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("accounts.listTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {accounts.length === 0 ? (
            <p className="text-sm text-ink-600">{t("accounts.empty")}</p>
          ) : (
            accounts.map((account) => {
              const draft = draftOf(account);
              return (
                <div key={account.id} className="space-y-3 rounded-xl border border-ink-300/55 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm" dir="ltr">
                      {account.currency}
                    </span>
                    <span className="text-sm text-ink-600">
                      {t(`accounts.kind.${account.kind}`)}
                    </span>
                    <Badge variant={account.is_public ? "up" : "neutral"}>
                      {account.is_public
                        ? t("accounts.badge.public")
                        : t("accounts.badge.internal")}
                    </Badge>
                    {!account.active ? (
                      <Badge variant="warn">{t("accounts.badge.inactive")}</Badge>
                    ) : null}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm font-medium">
                      {t("accounts.number")}
                      <Input
                        dir="ltr"
                        className="mt-1.5 text-start font-mono text-xs"
                        value={draft.number}
                        disabled={!canManage}
                        placeholder={t(`accounts.placeholder.${account.kind}`)}
                        onChange={(e) =>
                          setDrafts((d) => ({
                            ...d,
                            [account.id]: { ...draft, number: e.target.value },
                          }))
                        }
                      />
                    </label>
                    <label className="block text-sm font-medium">
                      {t("accounts.label")}
                      <Input
                        className="mt-1.5"
                        value={draft.label}
                        disabled={!canManage}
                        placeholder={t("accounts.labelPlaceholder")}
                        onChange={(e) =>
                          setDrafts((d) => ({
                            ...d,
                            [account.id]: { ...draft, label: e.target.value },
                          }))
                        }
                      />
                    </label>
                  </div>

                  {canManage ? (
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                      <ToggleField
                        label={t("accounts.publicLabel")}
                        hint={t("accounts.publicHint")}
                        checked={account.is_public}
                        disabled={busy === account.id}
                        onChange={(v) => toggle(account, "is_public", v)}
                      />
                      <ToggleField
                        label={t("accounts.activeLabel")}
                        hint={t("accounts.activeHint")}
                        checked={account.active}
                        disabled={busy === account.id}
                        onChange={(v) => toggle(account, "active", v)}
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        className="ms-auto"
                        disabled={
                          busy === account.id ||
                          (draft.number === accountNumber(account.details) &&
                            draft.label === (account.label ?? ""))
                        }
                        onClick={() => saveRow(account)}
                      >
                        <Save className="size-4" aria-hidden />
                        {busy === account.id ? t("accounts.working") : t("accounts.save")}
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("accounts.addTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium">
                {t("accounts.currency")}
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="mt-1.5 h-11 w-full rounded-xl border border-ink-300 bg-surface px-3 text-sm focus:border-brand-600 focus:ring-2 focus:ring-brand-600/25 focus:outline-none"
                >
                  {CURRENCY_CODES.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium">
                {t("accounts.kindLabel")}
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as AccountKind)}
                  className="mt-1.5 h-11 w-full rounded-xl border border-ink-300 bg-surface px-3 text-sm focus:border-brand-600 focus:ring-2 focus:ring-brand-600/25 focus:outline-none"
                >
                  {KINDS.map((k) => (
                    <option key={k} value={k}>
                      {t(`accounts.kind.${k}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium">
                {t("accounts.number")}
                <Input
                  dir="ltr"
                  className="mt-1.5 text-start font-mono text-xs"
                  value={newNumber}
                  placeholder={t(`accounts.placeholder.${kind}`)}
                  onChange={(e) => setNewNumber(e.target.value)}
                />
              </label>
              <label className="block text-sm font-medium">
                {t("accounts.label")}
                <Input
                  className="mt-1.5"
                  value={newLabel}
                  placeholder={t("accounts.labelPlaceholder")}
                  onChange={(e) => setNewLabel(e.target.value)}
                />
              </label>
            </div>
            <Button disabled={busy !== null || newNumber.trim().length < 3} onClick={add}>
              <Plus className="size-4" aria-hidden />
              {busy === "new" ? t("accounts.working") : t("accounts.add")}
            </Button>
          </CardContent>
        </Card>
      ) : null}

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

function ToggleField({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  const hintId = React.useId();
  return (
    <span className="flex items-center gap-2.5">
      <Switch
        checked={checked}
        disabled={disabled}
        aria-label={label}
        aria-describedby={hintId}
        onCheckedChange={onChange}
      />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span id={hintId} className="block text-xs text-ink-600">
          {hint}
        </span>
      </span>
    </span>
  );
}

function detailsObject(details: Json): Record<string, Json> {
  return details && typeof details === "object" && !Array.isArray(details) ? details : {};
}

/** Whatever shape this account was provisioned with, reduced to one number. */
function accountNumber(details: Json): string {
  const object = detailsObject(details);
  for (const key of ["number", "iban", "sheba", "card", "swift", "account"]) {
    const value = object[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return "";
}
