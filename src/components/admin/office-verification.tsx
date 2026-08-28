"use client";

import { BadgeCheck, CircleAlert, KeyRound, Send, ShieldAlert, ShieldQuestion } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import * as React from "react";
import { PanelSection } from "@/components/layout/panel-section";
import { OfficeLogo, officeLogoUrl } from "@/components/office/office-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { OFFICE_USERNAME_RE, suggestUsername } from "@/lib/auth/office-login";
import { createClient } from "@/lib/supabase/client";
import type { ExchangeOffice, Json, OfficeKyc } from "@/lib/supabase/types";
import { validateNationalCode } from "@/lib/validators";

/**
 * The administrator's view of who an office is, and the two things only they
 * can do about it: decide the identity check, and issue a login.
 *
 * The brief puts identity verification of both offices and users on the
 * administrator, and this is the office half. It sits beside the office's own
 * details rather than in a queue of its own because an office is verified once,
 * by someone already looking at it — a queue would be a screen with one row in
 * it for most of a year.
 *
 * A rejection asks for a reason and the database refuses one shorter than eight
 * characters. That is not bureaucracy: the office will ask why, and "the system
 * said no" is not an answer anybody can act on.
 */
export function OfficeVerification({ office }: { office: ExchangeOffice }) {
  const t = useTranslations("adminOffice");
  const router = useRouter();

  const [reason, setReason] = React.useState("");
  const [ownerName, setOwnerName] = React.useState(office.owner_name ?? "");
  const [nationalId, setNationalId] = React.useState(office.national_id ?? "");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<string | null>(null);

  const codeValid = nationalId.trim() === "" || validateNationalCode(nationalId);
  const identityChanged =
    ownerName.trim() !== (office.owner_name ?? "") ||
    nationalId.trim() !== (office.national_id ?? "");

  async function decide(decision: OfficeKyc) {
    setBusy(true);
    setError(null);
    const { error: rpcError } = await createClient().rpc("admin_decide_office_kyc", {
      p_office: office.id,
      p_decision: decision,
      p_reason: reason.trim() || null,
    });
    setBusy(false);
    if (rpcError) {
      setError(
        /written reason/i.test(rpcError.message ?? "")
          ? t("errors.reasonRequired")
          : t("errors.saveFailed"),
      );
      return;
    }
    setNote(t("decided"));
    router.refresh();
  }

  async function saveIdentity() {
    setBusy(true);
    setError(null);
    const { error: rpcError } = await createClient().rpc("admin_update_office", {
      p_office: office.id,
      p_patch: {
        owner_name: ownerName.trim() || null,
        national_id: nationalId.trim() || null,
        reason: reason.trim() || "identity details corrected",
      } as unknown as Json,
    });
    setBusy(false);
    if (rpcError) {
      setError(
        /national code is not valid/i.test(rpcError.message ?? "")
          ? t("errors.nationalId")
          : t("errors.saveFailed"),
      );
      return;
    }
    setNote(t("saved"));
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <PanelSection title={t("identity.title")} hint={t("identity.hint")} bodyClassName="space-y-5">
        <div className="flex flex-wrap items-center gap-4">
          <OfficeLogo
            name={office.display_name ?? office.legal_name_fa}
            logoUrl={officeLogoUrl(office.logo_path)}
            officeId={office.id}
            size={64}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold">
              {office.display_name ?? office.legal_name_fa}
            </p>
            <p className="truncate font-mono text-xs text-ink-600" dir="ltr">
              {office.slug} · {office.license_no}
            </p>
          </div>
          <StateBadge state={office.kyc_state} />
        </div>

        {office.kyc_reason ? (
          <p className="rounded-xl bg-ink-300/20 p-3 text-sm leading-relaxed text-ink-600">
            {office.kyc_reason}
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            {t("identity.ownerName")}
            <Input
              className="mt-1.5"
              value={ownerName}
              disabled={busy}
              onChange={(e) => setOwnerName(e.target.value)}
            />
          </label>
          <label className="block text-sm font-medium">
            {t("identity.nationalId")}
            <Input
              className="mt-1.5 font-mono"
              dir="ltr"
              inputMode="numeric"
              maxLength={12}
              value={nationalId}
              disabled={busy}
              onChange={(e) => setNationalId(e.target.value)}
            />
            <span
              className={
                codeValid ? "mt-1 block text-xs text-ink-600" : "mt-1 block text-xs text-down"
              }
            >
              {codeValid ? t("identity.nationalIdHint") : t("errors.nationalId")}
            </span>
          </label>
        </div>

        <label className="block text-sm font-medium">
          {t("identity.reason")}
          <Input
            className="mt-1.5"
            value={reason}
            disabled={busy}
            placeholder={t("identity.reasonPlaceholder")}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>

        <div className="flex flex-wrap gap-2">
          {identityChanged ? (
            <Button variant="secondary" disabled={busy || !codeValid} onClick={saveIdentity}>
              {t("identity.save")}
            </Button>
          ) : null}
          <Button
            disabled={busy || office.kyc_state === "verified"}
            onClick={() => decide("verified")}
          >
            <BadgeCheck className="size-4" aria-hidden />
            {t("identity.verify")}
          </Button>
          <Button
            variant="destructive"
            disabled={busy || office.kyc_state === "rejected"}
            onClick={() => decide("rejected")}
          >
            <ShieldAlert className="size-4" aria-hidden />
            {t("identity.reject")}
          </Button>
        </div>

        <p className="text-xs leading-relaxed text-ink-600">{t("identity.note")}</p>

        {error ? (
          <p className="flex items-start gap-1.5 text-sm text-down">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error}
          </p>
        ) : null}
        {note && !error ? <p className="text-sm text-up">{note}</p> : null}
      </PanelSection>

      <IssueLogin office={office} />
    </div>
  );
}

/**
 * Issue this office a login, after the fact.
 *
 * The provisioning wizard offers this too, and it is deliberately available
 * again here: an office may be created before anyone knows who will run the
 * counter, a phone gets changed, and a password read out over a bad line gets
 * lost. Re-issuing supersedes any open invitation rather than racing it.
 */
function IssueLogin({ office }: { office: ExchangeOffice }) {
  const t = useTranslations("adminOffice");
  const [username, setUsername] = React.useState(() => suggestUsername(office.slug));
  const [phone, setPhone] = React.useState(office.owner_phone ?? "");
  const [sendSms, setSendSms] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [issued, setIssued] = React.useState<{
    username: string;
    password: string;
    sms: string;
  } | null>(null);

  const ready = OFFICE_USERNAME_RE.test(username.trim().toLowerCase()) && phone.trim().length >= 10;

  async function issue() {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/admin/office-invite", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        officeId: office.id,
        username: username.trim().toLowerCase(),
        phone: phone.trim(),
        sendSms,
      }),
    });
    const body = (await response.json().catch(() => ({}))) as {
      username?: string;
      password?: string;
      sms?: string;
      error?: string;
    };
    setBusy(false);
    if (!response.ok || !body.password) {
      setError(t(body.error === "username_taken" ? "errors.usernameTaken" : "errors.saveFailed"));
      return;
    }
    setIssued({
      username: body.username ?? username,
      password: body.password,
      sms: body.sms ?? "skipped",
    });
  }

  return (
    <PanelSection title={t("login.title")} hint={t("login.hint")} bodyClassName="space-y-4">
      {issued ? (
        <>
          <dl className="space-y-2 rounded-xl border border-ink-300/55 p-4">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-sm text-ink-600">{t("login.username")}</dt>
              <dd className="font-mono text-sm" dir="ltr">
                {issued.username}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-sm text-ink-600">{t("login.password")}</dt>
              <dd className="font-mono text-base font-semibold" dir="ltr">
                {issued.password}
              </dd>
            </div>
          </dl>
          <p className="flex items-center gap-1.5 text-sm text-ink-600">
            <Send className="size-4 shrink-0" aria-hidden />
            {t(`login.sms.${issued.sms}`)}
          </p>
          <p className="rounded-xl bg-warn/10 p-3 text-sm leading-relaxed text-warn-ink">
            {t("login.warning")}
          </p>
          <Button variant="secondary" onClick={() => setIssued(null)}>
            {t("login.again")}
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm leading-relaxed text-ink-600">{t("login.body")}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              {t("login.username")}
              <Input
                className="mt-1.5 font-mono"
                dir="ltr"
                value={username}
                disabled={busy}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
              />
            </label>
            <label className="block text-sm font-medium">
              {t("login.phone")}
              <Input
                className="mt-1.5 font-mono"
                dir="ltr"
                inputMode="tel"
                value={phone}
                disabled={busy}
                onChange={(e) => setPhone(e.target.value)}
              />
            </label>
          </div>
          <label className="flex items-start gap-2.5">
            <Switch checked={sendSms} onCheckedChange={setSendSms} disabled={busy} />
            <span>
              <span className="block text-sm font-medium">{t("login.sendSms")}</span>
              <span className="block text-xs leading-relaxed text-ink-600">
                {t("login.sendSmsHint")}
              </span>
            </span>
          </label>
          <Button disabled={!ready || busy} onClick={issue}>
            <KeyRound className="size-4" aria-hidden />
            {busy ? t("login.working") : t("login.cta")}
          </Button>
          {error ? (
            <p className="flex items-start gap-1.5 text-sm text-down">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {error}
            </p>
          ) : null}
        </>
      )}
    </PanelSection>
  );
}

function StateBadge({ state }: { state: OfficeKyc }) {
  const t = useTranslations("adminOffice");
  if (state === "verified") {
    return (
      <Badge variant="up">
        <BadgeCheck className="size-3.5" aria-hidden />
        {t(`kyc.${state}`)}
      </Badge>
    );
  }
  if (state === "rejected") {
    return (
      <Badge variant="down">
        <ShieldAlert className="size-3.5" aria-hidden />
        {t(`kyc.${state}`)}
      </Badge>
    );
  }
  return (
    <Badge variant={state === "pending" ? "warn" : "neutral"}>
      <ShieldQuestion className="size-3.5" aria-hidden />
      {t(`kyc.${state}`)}
    </Badge>
  );
}
