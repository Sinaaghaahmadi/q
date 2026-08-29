"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Mail, ShieldCheck, Smartphone } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { OtpScene, SuccessScene } from "@/components/brand/scenes/core";
import { EASE_IN } from "@/components/brand/scene";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Link, useRouter } from "@/i18n/navigation";
import { OFFICE_USERNAME_RE } from "@/lib/auth/office-login";
import { createClient } from "@/lib/supabase/client";
import { toLatinDigits, toPersianDigits, type AppLocale } from "@/lib/money/format";
import { cn } from "@/lib/utils";

type Channel = "phone" | "email" | "staff";
/**
 * `totp` sits between the password and the panel. It is not a gate — the
 * database already refuses a staff seat that has not reached aal2 (migration
 * 0028) — it is the screen where the person supplies what raises them to it.
 */
type Step = "identify" | "code" | "sent" | "totp" | "done";

const CODE_LENGTH = 6;
const RESEND_SECONDS = 120;

export function SignInForm({ nextPath = "/verify" }: { nextPath?: string }) {
  const t = useTranslations("auth");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const reduce = useReducedMotion();

  const [channel, setChannel] = React.useState<Channel>("phone");
  const [step, setStep] = React.useState<Step>("identify");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [code, setCode] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [cooldown, setCooldown] = React.useState(0);
  /**
   * Accepting the terms, as an act rather than an inference.
   *
   * The page already said that signing in constitutes acceptance, and that
   * sentence is still there. A line of small print under a button is a weak
   * record though: it shows the words were on the page, not that anybody passed
   * them. A box that has to be ticked before the button works is a deliberate
   * act, taken at a moment when all three documents are one tap away, and it
   * costs an honest user a single tap.
   *
   * Deliberately not remembered between visits — a stored tick would be the
   * same inference wearing a checkbox.
   */
  const [accepted, setAccepted] = React.useState(false);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  async function requestCode() {
    setBusy(true);
    setError(null);
    try {
      const body =
        channel === "phone"
          ? { channel: "phone" as const, phone: toLatinDigits(phone) }
          : { channel: "email" as const, email: email.trim() };

      const res = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        retryAfterMinutes?: number;
      };

      if (!res.ok) {
        setError(
          payload.error === "rate_limited"
            ? t("errors.rateLimited", { minutes: payload.retryAfterMinutes ?? 10 })
            : payload.error === "sms_channel_unavailable"
              ? t("errors.smsUnavailable")
              : payload.error === "invalid_phone"
                ? t("errors.invalidPhone")
                : payload.error === "auth_unavailable"
                  ? t("errors.authUnavailable")
                  : t("errors.sendFailed"),
        );
        return;
      }

      setCooldown(RESEND_SECONDS);
      setStep(channel === "phone" ? "code" : "sent");
    } catch {
      setError(t("errors.network"));
    } finally {
      setBusy(false);
    }
  }

  /** Staff only — the route refuses anyone without a `memberships` row. */
  async function submitPassword() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        mfaRequired?: boolean;
      };
      if (!res.ok) {
        setError(
          payload.error === "not_staff"
            ? t("errors.notStaff")
            : payload.error === "auth_unavailable"
              ? t("errors.authUnavailable")
              : t("errors.invalidCredentials"),
        );
        return;
      }
      if (payload.mfaRequired) {
        // The session exists but is only aal1, which the database treats as no
        // staff seat at all. Ask for the factor rather than navigating into a
        // panel that would render empty.
        setCode("");
        setStep("totp");
        return;
      }
      setStep("done");
      setTimeout(() => router.push(nextPath), 900);
    } catch {
      setError(t("errors.network"));
    } finally {
      setBusy(false);
    }
  }

  /**
   * Answer the second factor.
   *
   * Done in the browser rather than through a route because Supabase's MFA
   * challenge is bound to the session its client holds, and the client here
   * already has it. Verifying rewrites the session cookie at aal2, which is the
   * whole point — every later request, server or browser, carries the raised
   * level without anything else being told about it.
   */
  async function submitTotp() {
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const factor = (factors?.totp ?? []).find((f) => f.status === "verified");
      if (!factor) {
        setError(t("errors.invalidCode"));
        return;
      }
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: factor.id,
      });
      if (challengeError || !challenge) {
        setError(t("errors.invalidCode"));
        return;
      }
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: factor.id,
        challengeId: challenge.id,
        code: toLatinDigits(code).replace(/\D/g, ""),
      });
      if (verifyError) {
        setError(t("errors.invalidCode"));
        return;
      }
      setStep("done");
      setTimeout(() => router.push(nextPath), 900);
    } catch {
      setError(t("errors.network"));
    } finally {
      setBusy(false);
    }
  }

  async function submitCode() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: toLatinDigits(phone), token: toLatinDigits(code) }),
      });
      if (!res.ok) {
        setError(t("errors.invalidCode"));
        return;
      }
      setStep("done");
      setTimeout(() => router.push(nextPath), 900);
    } catch {
      setError(t("errors.network"));
    } finally {
      setBusy(false);
    }
  }

  const mm = String(Math.floor(cooldown / 60)).padStart(2, "0");
  const ss = String(cooldown % 60).padStart(2, "0");
  const clock = locale === "fa" ? toPersianDigits(`${mm}:${ss}`) : `${mm}:${ss}`;

  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  // An exchange office signs in with a username rather than an address — a
  // clerk should not need a mailbox to open the panel — so the staff field
  // accepts either, and the route resolves whichever it is given.
  const staffIdValid = emailValid || OFFICE_USERNAME_RE.test(email.trim().toLowerCase());
  const channelValid =
    channel === "phone"
      ? /^\d{10,13}$/.test(
          toLatinDigits(phone)
            .replace(/^\+?98/, "")
            .replace(/^0/, ""),
        )
      : channel === "staff"
        ? staffIdValid && password.length >= 8
        : emailValid;
  // Every channel, including staff pressing Enter in the password field.
  const identifierValid = channelValid && accepted;

  return (
    <Card className="mx-auto w-full max-w-md overflow-hidden p-6 shadow-e2 sm:p-8">
      <div className="flex flex-col items-center text-center">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step === "done" ? "done" : "otp"}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0, scale: 0.96 }}
            transition={reduce ? { duration: 0 } : { duration: 0.35, ease: EASE_IN }}
          >
            {step === "done" ? (
              <SuccessScene size={128} label={t("scene.done")} />
            ) : (
              <OtpScene size={128} label={t("scene.otp")} />
            )}
          </motion.div>
        </AnimatePresence>

        <h1 className="mt-4 text-xl font-bold">
          {step === "code"
            ? t("codeTitle")
            : step === "sent"
              ? t("sentTitle")
              : step === "done"
                ? t("doneTitle")
                : t("title")}
        </h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-600">
          {step === "code"
            ? t("codeBody", { phone: phone })
            : step === "sent"
              ? t("sentBody", { email: email })
              : step === "done"
                ? t("doneBody")
                : t("body")}
        </p>
      </div>

      {step === "identify" ? (
        <div className="mt-6 space-y-4">
          <Segmented<Channel>
            className="w-full"
            label={t("channelLabel")}
            value={channel}
            onChange={setChannel}
            options={[
              {
                value: "phone",
                label: (
                  <>
                    <Smartphone className="size-4" aria-hidden />
                    {t("channel.phone")}
                  </>
                ),
              },
              {
                value: "email",
                label: (
                  <>
                    <Mail className="size-4" aria-hidden />
                    {t("channel.email")}
                  </>
                ),
              },
              {
                value: "staff",
                label: (
                  <>
                    <ShieldCheck className="size-4" aria-hidden />
                    {t("channel.staff")}
                  </>
                ),
              },
            ]}
          />

          {channel === "phone" ? (
            <div>
              <label htmlFor="signin-phone" className="text-sm font-medium">
                {t("phoneLabel")}
              </label>
              <Input
                id="signin-phone"
                dir="ltr"
                inputMode="tel"
                autoComplete="tel"
                placeholder="0912 345 6789"
                className="mt-2 text-start font-mono"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <p className="mt-1.5 text-xs text-ink-600">{t("phoneHint")}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label htmlFor="signin-email" className="text-sm font-medium">
                  {channel === "staff" ? t("staffIdLabel") : t("emailLabel")}
                </label>
                <Input
                  id="signin-email"
                  dir="ltr"
                  // `type="email"` on the staff field would make a browser
                  // refuse a perfectly good username, so it stays plain text
                  // there and the field validates itself.
                  type={channel === "staff" ? "text" : "email"}
                  autoComplete={channel === "staff" ? "username" : "email"}
                  placeholder={channel === "staff" ? "tehran.desk" : "you@example.com"}
                  className="mt-2 text-start"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <p className="mt-1.5 text-xs text-ink-600">
                  {channel === "staff" ? t("staffHint") : t("emailHint")}
                </p>
              </div>

              {channel === "staff" ? (
                <div>
                  <label htmlFor="signin-password" className="text-sm font-medium">
                    {t("passwordLabel")}
                  </label>
                  <Input
                    id="signin-password"
                    dir="ltr"
                    type="password"
                    autoComplete="current-password"
                    className="mt-2 text-start"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && identifierValid && !busy) void submitPassword();
                    }}
                  />
                </div>
              ) : null}
            </div>
          )}

          {error ? <p className="text-sm leading-relaxed text-down">{error}</p> : null}

          {/* The notice names three documents, so it links to all three: an
              acceptance recorded against terms the person had no way to open is
              worth very little if it is ever tested. It sits above the button
              rather than under it, because a condition read after the decision
              is not a condition. */}
          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-ink-300/60 bg-canvas/60 p-3 text-xs leading-relaxed text-ink-600">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-brand-600"
            />
            <span>
              {t.rich("legalNote", {
                terms: (c) => (
                  <Link
                    href="/legal/terms"
                    className="underline underline-offset-2 hover:text-ink-900"
                  >
                    {c}
                  </Link>
                ),
                privacy: (c) => (
                  <Link
                    href="/legal/privacy"
                    className="underline underline-offset-2 hover:text-ink-900"
                  >
                    {c}
                  </Link>
                ),
                aml: (c) => (
                  <Link
                    href="/legal/aml"
                    className="underline underline-offset-2 hover:text-ink-900"
                  >
                    {c}
                  </Link>
                ),
              })}
            </span>
          </label>

          <Button
            size="lg"
            className="w-full"
            /* A stable hook for the screenshot script, which signs in through
               this form rather than injecting a session. It used to reach the
               button by "the last one on the page" and quietly started
               pressing the footer's menu instead. */
            data-testid="signin-submit"
            disabled={!identifierValid || busy}
            onClick={channel === "staff" ? submitPassword : requestCode}
          >
            {busy ? t("sending") : channel === "staff" ? t("staffCta") : t("cta")}
            <ArrowRight className="size-4 rtl:-scale-x-100" />
          </Button>
        </div>
      ) : null}

      {step === "code" ? (
        <div className="mt-6 space-y-4">
          <label htmlFor="signin-code" className="sr-only">
            {t("codeLabel")}
          </label>
          <Input
            id="signin-code"
            dir="ltr"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={CODE_LENGTH}
            placeholder="······"
            className={cn(
              "num h-14 text-center text-2xl font-semibold tracking-[0.5em]",
              error && "border-down",
            )}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))}
          />
          {error ? <p className="text-sm text-down">{error}</p> : null}

          <Button
            size="lg"
            className="w-full"
            disabled={code.length < CODE_LENGTH || busy}
            onClick={submitCode}
          >
            {busy ? t("verifying") : t("verifyCta")}
          </Button>

          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              className="text-ink-600 underline-offset-4 hover:text-ink-900 hover:underline"
              onClick={() => {
                setStep("identify");
                setCode("");
                setError(null);
              }}
            >
              {t("changeNumber")}
            </button>
            {cooldown > 0 ? (
              <span className="num text-ink-600">{t("resendIn", { clock })}</span>
            ) : (
              <button
                type="button"
                className="font-medium text-brand-600 hover:text-brand-700"
                onClick={requestCode}
              >
                {t("resend")}
              </button>
            )}
          </div>
        </div>
      ) : null}

      {step === "totp" ? (
        <div className="mt-6 space-y-4">
          <p className="text-sm leading-relaxed text-ink-600">{t("totpPrompt")}</p>
          <label htmlFor="signin-totp" className="sr-only">
            {t("totpLabel")}
          </label>
          <Input
            id="signin-totp"
            dir="ltr"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={CODE_LENGTH}
            placeholder="······"
            className="text-center font-mono text-2xl tracking-[0.4em]"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && code.replace(/\D/g, "").length === CODE_LENGTH && !busy) {
                void submitTotp();
              }
            }}
          />
          {error ? <p className="text-sm leading-relaxed text-down">{error}</p> : null}
          <Button
            size="lg"
            className="w-full"
            disabled={busy || code.replace(/\D/g, "").length < CODE_LENGTH}
            onClick={submitTotp}
          >
            {busy ? t("verifying") : t("totpCta")}
            <ArrowRight className="size-4 rtl:-scale-x-100" />
          </Button>
          <p className="text-center text-xs leading-relaxed text-ink-600">{t("totpLost")}</p>
        </div>
      ) : null}

      {step === "sent" ? (
        <div className="mt-6 space-y-4 text-center">
          <Badge variant="brand">{t("checkInbox")}</Badge>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => {
              setStep("identify");
              setError(null);
            }}
          >
            {t("changeEmail")}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
