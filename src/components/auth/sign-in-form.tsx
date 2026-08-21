"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Mail, Smartphone } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { OtpScene, SuccessScene } from "@/components/brand/scenes";
import { EASE_IN } from "@/components/brand/scene";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRouter } from "@/i18n/navigation";
import { toLatinDigits, toPersianDigits, type AppLocale } from "@/lib/money/format";
import { cn } from "@/lib/utils";

type Channel = "phone" | "email";
type Step = "identify" | "code" | "sent" | "done";

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
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [cooldown, setCooldown] = React.useState(0);

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

  const identifierValid =
    channel === "phone"
      ? /^\d{10,13}$/.test(
          toLatinDigits(phone)
            .replace(/^\+?98/, "")
            .replace(/^0/, ""),
        )
      : /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

  return (
    <Card className="mx-auto w-full max-w-md overflow-hidden p-6 shadow-e2 sm:p-8">
      <div className="flex flex-col items-center text-center">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step === "done" ? "done" : "otp"}
            initial={reduce ? false : { opacity: 0, scale: 0.94 }}
            animate={reduce ? undefined : { opacity: 1, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0, scale: 0.96 }}
            transition={reduce ? undefined : { duration: 0.35, ease: EASE_IN }}
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
          <Tabs value={channel} onValueChange={(v) => setChannel(v as Channel)}>
            <TabsList className="w-full">
              <TabsTrigger value="phone" className="flex-1 gap-1.5">
                <Smartphone className="size-4" />
                {t("channel.phone")}
              </TabsTrigger>
              <TabsTrigger value="email" className="flex-1 gap-1.5">
                <Mail className="size-4" />
                {t("channel.email")}
              </TabsTrigger>
            </TabsList>
          </Tabs>

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
            <div>
              <label htmlFor="signin-email" className="text-sm font-medium">
                {t("emailLabel")}
              </label>
              <Input
                id="signin-email"
                dir="ltr"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                className="mt-2 text-start"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <p className="mt-1.5 text-xs text-ink-600">{t("emailHint")}</p>
            </div>
          )}

          {error ? <p className="text-sm leading-relaxed text-down">{error}</p> : null}

          <Button
            size="lg"
            className="w-full"
            disabled={!identifierValid || busy}
            onClick={requestCode}
          >
            {busy ? t("sending") : t("cta")}
            <ArrowRight className="size-4 rtl:-scale-x-100" />
          </Button>
          <p className="text-center text-xs leading-relaxed text-ink-600">{t("legalNote")}</p>
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
