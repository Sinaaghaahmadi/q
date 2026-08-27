"use client";

import { ArrowRight, CircleCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { OtpScene, SuccessScene } from "@/components/brand/scenes/core";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";
import { toLatinDigits, toPersianDigits, type AppLocale } from "@/lib/money/format";
import { createClient } from "@/lib/supabase/client";
import type { Json, TicketCategory } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

const CATEGORIES: TicketCategory[] = [
  "order",
  "payment",
  "kyc",
  "p2p",
  "account",
  "office",
  "other",
];
const CODE_LENGTH = 6;

/**
 * File a ticket without first "creating an account".
 *
 * A ticket needs an identity — otherwise there is nobody to answer, and the
 * queue fills with things nobody can follow up. But the usual shape of that
 * requirement is hostile: a person with a problem is bounced to a sign-up form,
 * then a verification screen, then back to a blank ticket form having lost what
 * they were going to say.
 *
 * So the message comes first. You write the problem, then prove the phone, and
 * the ticket is filed on the same submit — the identity step is a gate placed
 * *after* the effort rather than before it, and nothing typed is ever lost to
 * it. Somebody already signed in never sees the middle step at all.
 */
export function TicketComposer({ signedIn }: { signedIn: boolean }) {
  const t = useTranslations("contact");
  const locale = useLocale() as AppLocale;
  const router = useRouter();

  const [step, setStep] = React.useState<"write" | "verify" | "done">("write");
  const [category, setCategory] = React.useState<TicketCategory>("order");
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [ref, setRef] = React.useState<string | null>(null);

  const written = subject.trim().length > 2 && body.trim().length > 4;
  const phoneOk = /^\d{10,13}$/.test(
    toLatinDigits(phone)
      .replace(/^\+?98/, "")
      .replace(/^0/, ""),
  );

  /** Actually create the ticket. Only ever called once identity is settled. */
  async function file(): Promise<boolean> {
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("ticket_open", {
      p_payload: {
        category,
        subject: subject.trim(),
        body: body.trim(),
      } as unknown as Json,
    });
    if (rpcError || !data) {
      setError(
        /too many tickets/i.test(rpcError?.message ?? "")
          ? t("errors.cooldown")
          : t("errors.failed"),
      );
      return false;
    }
    const { data: row } = await supabase
      .from("support_tickets")
      .select("public_ref")
      .eq("id", data)
      .maybeSingle();
    setRef(row?.public_ref ?? null);
    setStep("done");
    router.refresh();
    return true;
  }

  async function onWriteSubmit() {
    setBusy(true);
    setError(null);
    try {
      // Signed in already: nothing stands between the message and the queue.
      if (signedIn) {
        await file();
        return;
      }
      const res = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channel: "phone", phone: toLatinDigits(phone) }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(
          payload.error === "rate_limited"
            ? t("errors.rateLimited")
            : payload.error === "invalid_phone"
              ? t("errors.invalidPhone")
              : t("errors.sendFailed"),
        );
        return;
      }
      setStep("verify");
    } catch {
      setError(t("errors.network"));
    } finally {
      setBusy(false);
    }
  }

  async function onVerifySubmit() {
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
      // The message survived the identity step; file it now, unchanged.
      await file();
    } catch {
      setError(t("errors.network"));
    } finally {
      setBusy(false);
    }
  }

  if (step === "done") {
    return (
      <Card className="flex flex-col items-center gap-4 p-8 text-center">
        <SuccessScene size={120} label={t("done.title")} />
        <h2 className="text-xl font-bold">{t("done.title")}</h2>
        <p className="max-w-sm text-sm leading-relaxed text-ink-600">{t("done.body")}</p>
        {ref ? (
          <p className="num font-mono text-lg font-semibold" dir="ltr">
            {ref}
          </p>
        ) : null}
        <Button onClick={() => router.push("/support")}>
          {t("done.cta")}
          <ArrowRight className="size-4 rtl:-scale-x-100" />
        </Button>
      </Card>
    );
  }

  if (step === "verify") {
    return (
      <Card className="space-y-5 p-6 sm:p-8">
        <div className="flex flex-col items-center text-center">
          <OtpScene size={112} label={t("verify.title")} />
          <h2 className="mt-3 text-lg font-bold">{t("verify.title")}</h2>
          <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-600">
            {t("verify.body", {
              phone: locale === "fa" ? toPersianDigits(phone) : phone,
            })}
          </p>
        </div>

        <div>
          <label htmlFor="ticket-code" className="sr-only">
            {t("verify.codeLabel")}
          </label>
          <Input
            id="ticket-code"
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
        </div>

        {error ? <p className="text-sm leading-relaxed text-down">{error}</p> : null}

        <Button
          size="lg"
          className="w-full"
          disabled={code.length < CODE_LENGTH || busy}
          onClick={onVerifySubmit}
        >
          {busy ? t("verify.working") : t("verify.cta")}
        </Button>

        <button
          type="button"
          className="w-full text-center text-sm text-ink-600 underline-offset-4 hover:text-ink-900 hover:underline"
          onClick={() => {
            setStep("write");
            setCode("");
            setError(null);
          }}
        >
          {t("verify.back")}
        </button>
      </Card>
    );
  }

  return (
    <Card className="space-y-5 p-6 sm:p-8">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t("categoryLabel")}</legend>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setCategory(value)}
              aria-pressed={category === value}
              className={cn(
                "pressable rounded-full border px-3.5 py-2 text-sm font-medium",
                category === value
                  ? "border-brand-600 bg-brand-50 text-brand-700 dark:text-brand-600"
                  : "border-ink-300 text-ink-600 hover:border-ink-600/40",
              )}
            >
              {t(`categories.${value}`)}
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="ticket-subject" className="text-sm font-medium">
          {t("subjectLabel")}
        </label>
        <Input
          id="ticket-subject"
          value={subject}
          maxLength={160}
          onChange={(e) => setSubject(e.target.value)}
          placeholder={t("subjectPlaceholder")}
          className="mt-1.5"
        />
      </div>

      <div>
        <label htmlFor="ticket-body" className="text-sm font-medium">
          {t("bodyLabel")}
        </label>
        <textarea
          id="ticket-body"
          value={body}
          rows={5}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t("bodyPlaceholder")}
          className="mt-1.5 w-full rounded-xl border border-ink-300 bg-surface px-3 py-2.5 text-sm leading-relaxed focus:border-brand-600 focus:ring-2 focus:ring-brand-600/25 focus:outline-none"
        />
        <p className="mt-1.5 text-xs text-ink-600">{t("bodyHint")}</p>
      </div>

      {!signedIn ? (
        <div>
          <label htmlFor="ticket-phone" className="text-sm font-medium">
            {t("phoneLabel")}
          </label>
          <Input
            id="ticket-phone"
            dir="ltr"
            inputMode="tel"
            autoComplete="tel"
            placeholder="0912 345 6789"
            className="mt-1.5 text-start font-mono"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-relaxed text-ink-600">
            <CircleCheck className="mt-0.5 size-3.5 shrink-0 text-brand-600" aria-hidden />
            {t("phoneHint")}
          </p>
        </div>
      ) : null}

      {error ? <p className="text-sm leading-relaxed text-down">{error}</p> : null}

      <Button
        size="lg"
        className="w-full"
        disabled={!written || (!signedIn && !phoneOk) || busy}
        onClick={onWriteSubmit}
      >
        {busy ? t("working") : signedIn ? t("submitSignedIn") : t("submit")}
        <ArrowRight className="size-4 rtl:-scale-x-100" />
      </Button>
    </Card>
  );
}
