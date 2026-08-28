"use client";

import {
  BadgeCheck,
  CircleAlert,
  CreditCard,
  Landmark,
  Plus,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import * as React from "react";
import { BankMark } from "@/components/banks/bank-mark";
import { BankPicker } from "@/components/settlement/bank-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PanelSection } from "@/components/layout/panel-section";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { TERMS_VERSION } from "@/content/legal-version";
import { formatAmount, toLatinDigits, type AppLocale } from "@/lib/money/format";
import { fromMinor } from "@/lib/money/minor";
import { createClient } from "@/lib/supabase/client";
import type { Json, OfficeAccount } from "@/lib/supabase/types";
import {
  bankFromSheba,
  validateIranianCard,
  validateNationalCode,
  validateSheba,
} from "@/lib/validators";
import { cn } from "@/lib/utils";

type Kind = "card" | "iban";

/** An office's accounts plus the name to show above them. */
export interface SettlementGroup {
  officeId: string;
  officeName: string;
  accounts: OfficeAccount[];
}

/**
 * Settlement accounts — the screen an office opens when a card fills up.
 *
 * Iranian cards carry daily and monthly receiving ceilings. An office that hits
 * one cannot take Toman, which stops transfers, not paperwork. Waiting on us to
 * add a card would mean waiting hours; this lets them do it at the counter.
 *
 * The whole of the interesting logic is server-side, in `office_account_add`.
 * This screen never decides whether a holder name matched — a client that
 * decides whether it matched can decide that it did — it only asks, shows what
 * came back, and, on a real mismatch, presents the acceptance.
 *
 * That acceptance is not a formality and is not pre-ticked. §7 of the terms
 * says responsibility for a transfer to a non-matching account passes to the
 * person who chose to proceed, and a claim like that is worth exactly as much
 * as the evidence behind it. So the box is empty until a hand ticks it, the
 * reason is quoted in the words the database gave, and the terms are one tap
 * away.
 */
export function SettlementView({
  groups,
  locale,
  canManage,
  /** Platform staff see every office and pick which one they are acting for. */
  scope,
}: {
  groups: SettlementGroup[];
  locale: AppLocale;
  canManage: boolean;
  scope: "office" | "platform";
}) {
  const t = useTranslations("settlement");
  const router = useRouter();

  const [officeId, setOfficeId] = React.useState(groups[0]?.officeId ?? "");
  const [kind, setKind] = React.useState<Kind>("card");
  const [bankId, setBankId] = React.useState<string | null>(null);
  const [number, setNumber] = React.useState("");
  const [holder, setHolder] = React.useState("");
  const [code, setCode] = React.useState("");
  const [daily, setDaily] = React.useState("");

  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  /** Set when the server refused for a mismatch; carries its reason verbatim. */
  const [mismatch, setMismatch] = React.useState<string | null>(null);
  const [accepted, setAccepted] = React.useState(false);

  const digits = toLatinDigits(number).replace(/[\s-]/g, "");
  const cardCheck = kind === "card" ? validateIranianCard(digits) : null;
  const shebaCheck = kind === "iban" ? validateSheba(digits) : null;
  const detected = kind === "iban" ? (bankFromSheba(digits)?.id ?? null) : cardBank(cardCheck);
  const numberValid = kind === "card" ? cardCheck?.valid === true : shebaCheck?.valid === true;
  const codeValid = code.trim() === "" || validateNationalCode(toLatinDigits(code));

  // The sheba names its own bank. If the operator picked a different one, one of
  // the two is a slip — and it is far likelier to be the tap than the 24 digits
  // they pasted, so we say so rather than silently overwriting either.
  const bankDisagrees = detected !== null && bankId !== null && detected !== bankId;

  const ready = officeId !== "" && numberValid && holder.trim().length > 1 && codeValid;

  async function submit(withAcceptance: boolean) {
    setBusy(true);
    setError(null);
    const payload: Record<string, Json> = {
      office_id: officeId,
      kind,
      currency: "IRT",
      bank_id: bankId ?? detected,
      number: digits,
      holder_name: holder.trim(),
      holder_national_code: toLatinDigits(code).trim() || null,
      is_public: true,
      terms_version: TERMS_VERSION,
    };
    if (daily.trim()) payload.daily_ceiling_minor = Number(toLatinDigits(daily).replace(/\D/g, ""));
    if (withAcceptance) payload.accept_responsibility = true;

    const { error: rpcError } = await createClient().rpc("office_account_add", {
      p_payload: payload as Json,
    });
    setBusy(false);

    if (rpcError) {
      // `mismatch:<reason>` is the one refusal that is not a failure — it is the
      // server asking a question, and it gets the acceptance gate.
      const raw = rpcError.message ?? "";
      const at = raw.indexOf("mismatch:");
      if (at >= 0) {
        setMismatch(raw.slice(at + "mismatch:".length).trim());
        setAccepted(false);
        return;
      }
      // Everything else is an error, but not all errors are the same error.
      // The server refuses a bad checksum, an unknown office and a lost
      // connection for three different reasons, and "could not save, try again"
      // is only true of the third — for the first two it sends an operator to
      // retry something that will refuse them identically forever.
      setError(t(`errors.${serverErrorKey(raw)}`));
      return;
    }

    setMismatch(null);
    setAccepted(false);
    setNumber("");
    setHolder("");
    setCode("");
    setDaily("");
    setBankId(null);
    router.refresh();
  }

  async function retire(account: OfficeAccount) {
    setBusy(true);
    const { error: rpcError } = await createClient().rpc("office_account_retire", {
      p_account: account.id,
      p_reason: "ceiling",
    });
    setBusy(false);
    if (rpcError) {
      setError(t("errors.saveFailed"));
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-ink-600">{t("intro")}</p>

      {groups.map((group) => (
        <PanelSection
          key={group.officeId}
          title={scope === "platform" ? group.officeName : t("list.title")}
          hint={t("list.hint")}
          href={scope === "platform" ? `/admin/exchanges/${group.officeId}` : undefined}
          linkLabel={scope === "platform" ? t("list.openOffice") : undefined}
          bodyClassName="space-y-3"
        >
          {group.accounts.length === 0 ? (
            <p className="text-sm text-ink-600">{t("list.empty")}</p>
          ) : (
            <ul className="list-rise space-y-2.5">
              {group.accounts.map((account, i) => (
                <li key={account.id} style={{ "--i": i } as React.CSSProperties}>
                  <AccountRow
                    account={account}
                    locale={locale}
                    canManage={canManage}
                    busy={busy}
                    onRetire={() => retire(account)}
                  />
                </li>
              ))}
            </ul>
          )}
        </PanelSection>
      ))}

      {canManage ? (
        <PanelSection title={t("add.title")} hint={t("add.hint")} bodyClassName="space-y-5">
          {scope === "platform" && groups.length > 1 ? (
            <label className="block text-sm font-medium">
              {t("add.office")}
              <select
                value={officeId}
                onChange={(e) => setOfficeId(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-xl border border-ink-300 bg-surface px-3 text-sm focus:border-brand-600 focus:ring-2 focus:ring-brand-600/25 focus:outline-none"
              >
                {groups.map((g) => (
                  <option key={g.officeId} value={g.officeId}>
                    {g.officeName}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <fieldset>
            <legend className="text-sm font-medium">{t("add.kind")}</legend>
            <div className="mt-2 flex gap-2">
              {(["card", "iban"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={kind === k}
                  onClick={() => {
                    setKind(k);
                    setNumber("");
                  }}
                  className={cn(
                    "pressable flex flex-1 items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium",
                    kind === k
                      ? "border-brand-600 bg-brand-50 text-brand-700"
                      : "border-ink-300 text-ink-600",
                  )}
                >
                  {k === "card" ? (
                    <CreditCard className="size-4" aria-hidden />
                  ) : (
                    <Landmark className="size-4" aria-hidden />
                  )}
                  {t(`add.kind_${k}`)}
                </button>
              ))}
            </div>
          </fieldset>

          <div>
            <p className="mb-2 text-sm font-medium">{t("bank.label")}</p>
            <BankPicker value={bankId} onChange={setBankId} detected={detected} />
            {bankDisagrees ? (
              <p className="mt-2 flex items-start gap-1.5 text-xs text-warn-ink">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                {t("bank.disagrees")}
              </p>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              {t(`add.number_${kind}`)}
              <Input
                dir="ltr"
                inputMode="numeric"
                className="mt-1.5 text-start font-mono"
                value={number}
                placeholder={kind === "card" ? "6037 9915 2123 4504" : "IR82 0540 1026 8002 …"}
                onChange={(e) => setNumber(e.target.value)}
              />
              {number.trim() !== "" && !numberValid ? (
                <span className="mt-1 block text-xs text-down">{t(`errors.number_${kind}`)}</span>
              ) : null}
            </label>

            <label className="block text-sm font-medium">
              {t("add.holder")}
              <Input
                className="mt-1.5"
                value={holder}
                placeholder={t("add.holderPlaceholder")}
                onChange={(e) => setHolder(e.target.value)}
              />
            </label>

            <label className="block text-sm font-medium">
              {t("add.code")}
              <Input
                dir="ltr"
                inputMode="numeric"
                maxLength={12}
                className="mt-1.5 text-start font-mono"
                value={code}
                placeholder="0084575905"
                onChange={(e) => setCode(e.target.value)}
              />
              {!codeValid ? (
                <span className="mt-1 block text-xs text-down">{t("errors.code")}</span>
              ) : (
                <span className="mt-1 block text-xs text-ink-600">{t("add.codeHint")}</span>
              )}
            </label>

            <label className="block text-sm font-medium">
              {t("add.ceiling")}
              <Input
                dir="ltr"
                inputMode="numeric"
                className="mt-1.5 text-start font-mono"
                value={daily}
                placeholder="500000000"
                onChange={(e) => setDaily(e.target.value)}
              />
              <span className="mt-1 block text-xs text-ink-600">{t("add.ceilingHint")}</span>
            </label>
          </div>

          {mismatch ? (
            <MismatchGate
              reason={mismatch}
              accepted={accepted}
              busy={busy}
              onAccept={setAccepted}
              onConfirm={() => submit(true)}
              onCancel={() => {
                setMismatch(null);
                setAccepted(false);
              }}
            />
          ) : (
            <Button disabled={!ready || busy} onClick={() => submit(false)}>
              <Plus className="size-4" aria-hidden />
              {busy ? t("add.working") : t("add.cta")}
            </Button>
          )}

          {error ? (
            <p className="flex items-start gap-1.5 text-sm text-down">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {error}
            </p>
          ) : null}
        </PanelSection>
      ) : (
        <p className="text-sm text-ink-600">{t("readOnly")}</p>
      )}
    </div>
  );
}

/**
 * The acceptance.
 *
 * Deliberately not a `window.confirm` and deliberately not a pre-ticked box.
 * This is the moment the platform's liability moves onto a person, and the only
 * thing that makes that defensible later is that they were told exactly what
 * did not match, in their own language, with the clause one tap away, and had
 * to tick an empty box to continue.
 */
function MismatchGate({
  reason,
  accepted,
  busy,
  onAccept,
  onConfirm,
  onCancel,
}: {
  reason: string;
  accepted: boolean;
  busy: boolean;
  onAccept: (value: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("settlement");
  const reasonKey = REASON_KEYS[reason] ?? "unknown";

  return (
    <div className="space-y-3 rounded-2xl border border-warn/45 bg-warn/10 p-4">
      <p className="flex items-start gap-2 font-semibold text-warn-ink">
        <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
        {t("mismatch.title")}
      </p>
      <p className="text-sm leading-relaxed text-warn-ink">{t(`mismatch.reason.${reasonKey}`)}</p>
      <p className="text-sm leading-relaxed">{t("mismatch.body")}</p>

      <label className="flex items-start gap-2.5 text-sm leading-relaxed">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => onAccept(e.target.checked)}
          className="mt-1 size-4 shrink-0 accent-[var(--brand-600)]"
        />
        <span>
          {t("mismatch.checkbox")}{" "}
          <Link
            href="/legal/terms"
            className="underline underline-offset-2"
            target="_blank"
            rel="noreferrer"
          >
            {t("mismatch.termsLink")}
          </Link>
        </span>
      </label>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          {t("mismatch.cancel")}
        </Button>
        <Button variant="destructive" disabled={!accepted || busy} onClick={onConfirm}>
          {busy ? t("add.working") : t("mismatch.confirm")}
        </Button>
      </div>
    </div>
  );
}

function AccountRow({
  account,
  locale,
  canManage,
  busy,
  onRetire,
}: {
  account: OfficeAccount;
  locale: AppLocale;
  canManage: boolean;
  busy: boolean;
  onRetire: () => void;
}) {
  const t = useTranslations("settlement");
  const retired = account.retired_at !== null;

  return (
    <div
      className={cn(
        "glass flex flex-wrap items-center gap-3 p-3",
        retired ? "opacity-60" : "glass-lift",
      )}
    >
      <BankMark bankId={account.bank_id ?? bankOf(account)} size={40} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-sm" dir="ltr">
          {maskNumber(account.details, account.kind)}
        </p>
        <p className="truncate text-xs text-ink-600">
          {account.holder_name ?? t("list.noHolder")}
          {account.daily_ceiling_minor !== null
            ? ` · ${t("list.ceiling", {
                amount: formatAmount(fromMinor(account.daily_ceiling_minor, "IRT"), "IRT", locale),
              })}`
            : ""}
        </p>
      </div>

      <MatchBadge state={account.match_state} />
      {retired ? <Badge variant="neutral">{t("list.retired")}</Badge> : null}

      {canManage && !retired ? (
        <Button variant="secondary" size="sm" disabled={busy} onClick={onRetire}>
          {t("list.retire")}
        </Button>
      ) : null}
    </div>
  );
}

function MatchBadge({ state }: { state: OfficeAccount["match_state"] }) {
  const t = useTranslations("settlement");
  if (state === "verified") {
    return (
      <Badge variant="up">
        <BadgeCheck className="size-3.5" aria-hidden />
        {t("match.verified")}
      </Badge>
    );
  }
  if (state === "mismatch") {
    return (
      <Badge variant="warn">
        <ShieldAlert className="size-3.5" aria-hidden />
        {t("match.mismatch")}
      </Badge>
    );
  }
  return <Badge variant="neutral">{t("match.unverified")}</Badge>;
}

/**
 * The database's reasons, mapped to translation keys.
 *
 * The reason arrives in English because it is stored as evidence and evidence
 * does not get re-translated per viewer. What the operator reads is the
 * translation; what `settlement_acceptances` keeps is the original.
 */
/**
 * Map the server's refusals onto something an operator can act on.
 *
 * Matched on substrings rather than error codes because plpgsql `raise
 * exception` has no code to give — every one of these arrives as P0001. The
 * strings are the ones `office_account_add` raises, and they are stable because
 * they live in a migration, not in a string table someone may reword.
 */
function serverErrorKey(message: string): string {
  if (message.includes("card number is not valid")) return "number_card";
  if (message.includes("sheba number is not valid")) return "number_iban";
  if (message.includes("IBAN is not valid")) return "number_iban";
  if (message.includes("national code is not valid")) return "code";
  if (message.includes("not a member of that office")) return "forbidden";
  if (message.includes("needs a holder name")) return "holderRequired";
  if (message.includes("needs a number")) return "numberRequired";
  return "saveFailed";
}

const REASON_KEYS: Record<string, string> = {
  "no national code was given for the account holder": "noCode",
  "the holder national code differs from the office on file": "codeDiffers",
  "the holder name differs from the office registered name": "nameDiffers",
};

function cardBank(check: ReturnType<typeof validateIranianCard> | null): string | null {
  return check && check.valid ? check.bankId : null;
}

/**
 * Name the bank of a row provisioned before `bank_id` existed.
 *
 * The number itself carries the answer — a card's BIN, a sheba's three-digit
 * bank code — so an account added last year still gets its own mark rather than
 * the fallback, without a backfill migration that would have to guess at the
 * rows it could not parse.
 */
function bankOf(account: OfficeAccount): string | null {
  const object =
    account.details && typeof account.details === "object" && !Array.isArray(account.details)
      ? account.details
      : {};
  const raw = typeof object.number === "string" ? object.number : "";
  if (raw === "") return null;
  if (account.kind === "card") return cardBank(validateIranianCard(raw));
  return bankFromSheba(raw)?.id ?? null;
}

function maskNumber(details: Json, kind: OfficeAccount["kind"]): string {
  const object = details && typeof details === "object" && !Array.isArray(details) ? details : {};
  const value = object.number;
  const raw = typeof value === "string" ? value : "";
  if (raw === "") return "—";
  if (kind === "card" && raw.length === 16) {
    return `${raw.slice(0, 4)} •••• •••• ${raw.slice(12)}`;
  }
  if (raw.length > 10) return `${raw.slice(0, 6)} •••• ${raw.slice(-4)}`;
  return raw;
}
