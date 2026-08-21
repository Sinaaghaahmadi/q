"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Archive, CircleCheck, CircleX, Landmark, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { EASE_IN } from "@/components/brand/scene";
import { AccountsScene } from "@/components/brand/scenes";
import { CoinIcon } from "@/components/brand/coin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toLatinDigits } from "@/lib/money/format";
import { CURRENCY_CODES, type CurrencyCode } from "@/lib/rates/catalog";
import { createClient } from "@/lib/supabase/client";
import type { BeneficiaryAccount } from "@/lib/supabase/types";
import { validateIban, validateIranianCard, validateSheba } from "@/lib/validators";
import { cn } from "@/lib/utils";

type AccountKind = "sheba" | "card" | "iban" | "swift";

const IRANIAN_KINDS: AccountKind[] = ["sheba", "card"];

export function AccountsManager({ initial }: { initial: BeneficiaryAccount[] }) {
  const t = useTranslations("accounts");
  const reduce = useReducedMotion();
  const [accounts, setAccounts] = React.useState(initial);
  const [open, setOpen] = React.useState(false);

  async function refresh() {
    const supabase = createClient();
    const { data } = await supabase
      .from("beneficiary_accounts")
      .select("*")
      .is("archived_at", null)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (data) setAccounts(data);
  }

  async function archive(id: string) {
    const supabase = createClient();
    await supabase
      .from("beneficiary_accounts")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", id);
    setAccounts((list) => list.filter((a) => a.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="mt-1 max-w-xl text-sm text-ink-600">{t("subtitle")}</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4" />
          {t("add")}
        </Button>
      </div>

      {accounts.length === 0 ? (
        <Card className="flex flex-col items-center gap-4 p-10 text-center">
          <AccountsScene size={140} label={t("emptyTitle")} />
          <div>
            <h2 className="text-lg font-semibold">{t("emptyTitle")}</h2>
            <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-ink-600">
              {t("emptyBody")}
            </p>
          </div>
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            {t("addFirst")}
          </Button>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <AnimatePresence initial={false}>
            {accounts.map((account) => (
              <motion.div
                key={account.id}
                layout
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={reduce ? undefined : { opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, scale: 0.97 }}
                transition={reduce ? undefined : { duration: 0.28, ease: EASE_IN }}
              >
                <Card className="flex h-full flex-col gap-3 p-4">
                  <div className="flex items-start gap-3">
                    <CoinIcon code={account.currency as CurrencyCode} size={34} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{account.nickname}</p>
                      <p className="truncate text-xs text-ink-600">{account.holder_name}</p>
                    </div>
                    <Badge variant={account.is_third_party ? "warn" : "neutral"}>
                      {account.is_third_party ? t("thirdParty") : t("ownAccount")}
                    </Badge>
                  </div>

                  <p className="num truncate rounded-lg bg-canvas px-3 py-2 font-mono text-xs" dir="ltr">
                    {maskIdentifier(account)}
                  </p>

                  <div className="mt-auto flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs text-ink-600">
                      <Landmark className="size-3.5" />
                      {t(`kind.${account.kind}`)}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => archive(account.id)}>
                      <Archive className="size-4" />
                      {t("archive")}
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <AddAccountDialog
        open={open}
        onOpenChange={setOpen}
        onSaved={() => {
          setOpen(false);
          void refresh();
        }}
      />
    </div>
  );
}

function maskIdentifier(account: BeneficiaryAccount): string {
  const value =
    account.details.sheba ?? account.details.card ?? account.details.iban ?? account.details.swift ?? "";
  if (value.length <= 8) return value;
  return `${value.slice(0, 4)} •••• ${value.slice(-4)}`;
}

function AddAccountDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const t = useTranslations("accounts");
  const tBanks = useTranslations("design.validation.banks");

  const [kind, setKind] = React.useState<AccountKind>("sheba");
  const [nickname, setNickname] = React.useState("");
  const [holder, setHolder] = React.useState("");
  const [identifier, setIdentifier] = React.useState("");
  const [swiftBank, setSwiftBank] = React.useState("");
  const [currency, setCurrency] = React.useState<CurrencyCode>("IRT");
  const [thirdParty, setThirdParty] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setCurrency(IRANIAN_KINDS.includes(kind) ? "IRT" : "EUR");
    setIdentifier("");
  }, [kind]);

  const normalized = toLatinDigits(identifier);
  const validation = React.useMemo(() => {
    if (!normalized) return null;
    if (kind === "sheba") return validateSheba(normalized);
    if (kind === "card") return validateIranianCard(normalized);
    if (kind === "iban") return validateIban(normalized);
    return { valid: /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(normalized.toUpperCase()) } as const;
  }, [kind, normalized]);

  const bankId =
    kind === "card" && validation && "bankId" in validation ? validation.bankId : null;
  const valid = Boolean(validation?.valid) && nickname.trim().length > 1 && holder.trim().length > 2;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError(t("errors.signedOut"));
        return;
      }

      const details: Record<string, string> =
        kind === "sheba"
          ? { sheba: normalized.toUpperCase().startsWith("IR") ? normalized.toUpperCase() : `IR${normalized}` }
          : kind === "card"
            ? { card: normalized.replace(/\s/g, "") }
            : kind === "iban"
              ? { iban: normalized.toUpperCase(), bank: swiftBank.trim() }
              : { swift: normalized.toUpperCase(), bank: swiftBank.trim() };

      const { error: insertError } = await supabase.from("beneficiary_accounts").insert({
        user_id: user.id,
        nickname: nickname.trim(),
        currency,
        country: IRANIAN_KINDS.includes(kind) ? "IR" : "XX",
        kind,
        details,
        holder_name: holder.trim(),
        is_third_party: thirdParty,
      });

      if (insertError) {
        setError(t("errors.saveFailed"));
        return;
      }

      setNickname("");
      setHolder("");
      setIdentifier("");
      onSaved();
    } catch {
      setError(t("errors.network"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent variant="sheet" className="p-0 sm:max-w-lg">
        <div className="border-b border-ink-300/40 p-5 pe-12">
          <DialogTitle className="text-base font-semibold">{t("addTitle")}</DialogTitle>
          <p className="mt-1 text-sm text-ink-600">{t("addBody")}</p>
        </div>

        <div className="space-y-4 overflow-y-auto p-5">
          <Tabs value={kind} onValueChange={(v) => setKind(v as AccountKind)}>
            <TabsList className="w-full">
              <TabsTrigger value="sheba" className="flex-1">
                {t("kind.sheba")}
              </TabsTrigger>
              <TabsTrigger value="card" className="flex-1">
                {t("kind.card")}
              </TabsTrigger>
              <TabsTrigger value="iban" className="flex-1">
                {t("kind.iban")}
              </TabsTrigger>
              <TabsTrigger value="swift" className="flex-1">
                {t("kind.swift")}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div>
            <label htmlFor="acct-id" className="text-sm font-medium">
              {t(`identifier.${kind}`)}
            </label>
            <Input
              id="acct-id"
              dir="ltr"
              className="mt-2 text-start font-mono text-xs"
              placeholder={
                kind === "sheba"
                  ? "IR06 0120 0000 0000 1234 5678 90"
                  : kind === "card"
                    ? "6037 9911 2345 6789"
                    : kind === "iban"
                      ? "DE89 3704 0044 0532 0130 00"
                      : "BKMTIRTH"
              }
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              invalid={Boolean(normalized) && !validation?.valid}
            />
            {normalized ? (
              <p
                className={cn(
                  "mt-1.5 flex items-center gap-1.5 text-xs",
                  validation?.valid ? "text-up" : "text-down",
                )}
              >
                {validation?.valid ? (
                  <CircleCheck className="size-3.5" />
                ) : (
                  <CircleX className="size-3.5" />
                )}
                {validation?.valid
                  ? bankId
                    ? t("validBank", { bank: tBanks(bankId) })
                    : t("valid")
                  : t(`invalid.${kind}`)}
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-ink-600">{t(`hint.${kind}`)}</p>
            )}
          </div>

          {kind === "iban" || kind === "swift" ? (
            <div>
              <label htmlFor="acct-bank" className="text-sm font-medium">
                {t("bankName")}
              </label>
              <Input
                id="acct-bank"
                className="mt-2"
                value={swiftBank}
                onChange={(e) => setSwiftBank(e.target.value)}
                placeholder={t("bankPlaceholder")}
              />
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="acct-nickname" className="text-sm font-medium">
                {t("nickname")}
              </label>
              <Input
                id="acct-nickname"
                className="mt-2"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder={t("nicknamePlaceholder")}
              />
            </div>
            <div>
              <label htmlFor="acct-holder" className="text-sm font-medium">
                {t("holder")}
              </label>
              <Input
                id="acct-holder"
                className="mt-2"
                value={holder}
                onChange={(e) => setHolder(e.target.value)}
                placeholder={t("holderPlaceholder")}
              />
            </div>
          </div>

          {!IRANIAN_KINDS.includes(kind) ? (
            <div>
              <label htmlFor="acct-currency" className="text-sm font-medium">
                {t("currency")}
              </label>
              <select
                id="acct-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                className="mt-2 h-11 w-full rounded-xl border border-ink-300 bg-surface px-3 text-sm focus:border-brand-600 focus:ring-2 focus:ring-brand-600/25 focus:outline-none"
              >
                {CURRENCY_CODES.filter((c) => c !== "IRT").map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <label className="flex items-start gap-2.5 rounded-xl border border-ink-300/60 p-3">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-[var(--brand-600)]"
              checked={thirdParty}
              onChange={(e) => setThirdParty(e.target.checked)}
            />
            <span>
              <span className="block text-sm font-medium">{t("thirdPartyLabel")}</span>
              <span className="block text-xs leading-relaxed text-ink-600">
                {t("thirdPartyHint")}
              </span>
            </span>
          </label>

          {error ? <p className="text-sm text-down">{error}</p> : null}

          <Button size="lg" className="w-full" disabled={!valid || busy} onClick={save}>
            {busy ? t("saving") : t("save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
