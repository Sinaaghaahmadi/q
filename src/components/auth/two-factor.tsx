"use client";

import { CircleAlert, Copy, ShieldCheck, ShieldOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { toLatinDigits } from "@/lib/money/format";

type Factor = { id: string; status: string; friendly_name?: string | null };

/**
 * Setting up an authenticator app.
 *
 * The whole of the *enforcement* lives in migration 0028 — `is_platform_staff()`
 * returns false for a staff member who has enrolled a factor and not used it,
 * so the panels empty out and the RPCs refuse without this component being
 * involved at all. What is left here is the part a person has to do: scan a QR
 * code and type six digits back.
 *
 * The secret is shown in text beside the QR because a phone photographing a
 * screen is not always an option — a shared office terminal, a camera that will
 * not focus, an authenticator on the same device as the browser. Both encode
 * the same thing and Supabase hands us both.
 *
 * Disabling asks for a code rather than just a button. Supabase does not
 * require it, but "anyone holding this session can silently remove the second
 * factor" makes the second factor worth about as much as the session, which is
 * the thing it exists to protect.
 */
export function TwoFactor({ isStaff }: { isStaff: boolean }) {
  const t = useTranslations("twoFactor");
  const router = useRouter();

  const [factors, setFactors] = React.useState<Factor[] | null>(null);
  const [enrolling, setEnrolling] = React.useState<{
    factorId: string;
    qr: string;
    secret: string;
  } | null>(null);
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  const load = React.useCallback(async () => {
    const { data } = await createClient().auth.mfa.listFactors();
    setFactors((data?.totp ?? []) as Factor[]);
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const verified = (factors ?? []).filter((f) => f.status === "verified");
  const enabled = verified.length > 0;

  async function begin() {
    setBusy(true);
    setError(null);
    const supabase = createClient();

    // An abandoned enrolment leaves an `unverified` factor behind, and Supabase
    // refuses a second enrolment while one is outstanding. Clearing them first
    // is what stops "I closed the tab" from becoming "I can never turn this on".
    const { data: existing } = await supabase.auth.mfa.listFactors();
    for (const stale of (existing?.totp ?? []) as Factor[]) {
      if (stale.status !== "verified") {
        await supabase.auth.mfa.unenroll({ factorId: stale.id });
      }
    }

    const { data, error: mfaError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `asaex-${Date.now()}`,
    });
    setBusy(false);
    if (mfaError || !data) {
      setError(t("errors.enrollFailed"));
      return;
    }
    setEnrolling({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    setCode("");
  }

  async function confirm() {
    if (!enrolling) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: enrolling.factorId,
    });
    if (challengeError || !challenge) {
      setBusy(false);
      setError(t("errors.verifyFailed"));
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: enrolling.factorId,
      challengeId: challenge.id,
      code: toLatinDigits(code).replace(/\D/g, ""),
    });
    setBusy(false);
    if (verifyError) {
      setError(t("errors.wrongCode"));
      return;
    }

    setEnrolling(null);
    setCode("");
    await load();
    // Verifying raises this session to aal2, which changes what the database
    // will answer — so the server components have to be asked again.
    router.refresh();
  }

  async function disable() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const target = verified[0];
    if (!target) {
      setBusy(false);
      return;
    }

    // Prove possession before removing the thing that proves possession.
    const { data: challenge } = await supabase.auth.mfa.challenge({ factorId: target.id });
    if (challenge) {
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: target.id,
        challengeId: challenge.id,
        code: toLatinDigits(code).replace(/\D/g, ""),
      });
      if (verifyError) {
        setBusy(false);
        setError(t("errors.wrongCode"));
        return;
      }
    }

    const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: target.id });
    setBusy(false);
    if (unenrollError) {
      setError(t("errors.disableFailed"));
      return;
    }
    setCode("");
    await load();
    router.refresh();
  }

  async function copySecret() {
    if (!enrolling) return;
    try {
      await navigator.clipboard.writeText(enrolling.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // A denied clipboard is not worth a banner — the secret is on screen.
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {enabled ? (
          <Badge variant="up">
            <ShieldCheck className="size-3.5" aria-hidden />
            {t("on")}
          </Badge>
        ) : (
          <Badge variant={isStaff ? "warn" : "neutral"}>
            <ShieldOff className="size-3.5" aria-hidden />
            {t("off")}
          </Badge>
        )}
      </div>

      <p className="text-sm leading-relaxed text-ink-600">{isStaff ? t("bodyStaff") : t("body")}</p>

      {enrolling ? (
        <div className="space-y-3 rounded-xl border border-ink-300/55 p-4">
          <p className="text-sm font-medium">{t("scan")}</p>
          <div className="flex flex-wrap items-start gap-4">
            {/* Supabase returns the QR as an SVG data URI, so there is no
                library and no network request to render it. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={enrolling.qr}
              alt={t("qrAlt")}
              width={168}
              height={168}
              className="rounded-lg bg-white p-2"
            />
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-xs text-ink-600">{t("orType")}</p>
              <p className="font-mono text-sm break-all" dir="ltr">
                {enrolling.secret}
              </p>
              <Button variant="secondary" size="sm" onClick={copySecret}>
                <Copy className="size-4" aria-hidden />
                {copied ? t("copied") : t("copy")}
              </Button>
            </div>
          </div>

          <label className="block text-sm font-medium">
            {t("codeLabel")}
            <Input
              dir="ltr"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className="mt-1.5 w-40 text-center font-mono tracking-[0.3em]"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <Button disabled={busy || code.replace(/\D/g, "").length < 6} onClick={confirm}>
              {busy ? t("working") : t("confirm")}
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => setEnrolling(null)}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      ) : enabled ? (
        <div className="space-y-2">
          <label className="block text-sm font-medium">
            {t("codeToDisable")}
            <Input
              dir="ltr"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className="mt-1.5 w-40 text-center font-mono tracking-[0.3em]"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <Button
            variant="secondary"
            disabled={busy || code.replace(/\D/g, "").length < 6}
            onClick={disable}
          >
            {busy ? t("working") : t("disable")}
          </Button>
        </div>
      ) : (
        <Button disabled={busy} onClick={begin}>
          <ShieldCheck className="size-4" aria-hidden />
          {busy ? t("working") : t("enable")}
        </Button>
      )}

      {error ? (
        <p className="flex items-start gap-1.5 text-sm text-down">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}
    </div>
  );
}
