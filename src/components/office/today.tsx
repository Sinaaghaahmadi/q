"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, CircleAlert, Coffee, Copy, HandCoins, Send, ThumbsUp } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import * as React from "react";
import { CoinIcon } from "@/components/brand/coin";
import { EASE_IN } from "@/components/brand/scene";
import { AppTile } from "@/components/brand/app-tile";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InfoHint } from "@/components/ui/info-hint";
import { Link } from "@/i18n/navigation";
import { formatAmount, type AppLocale } from "@/lib/money/format";
import { fromMinor } from "@/lib/money/minor";
import {
  beatOf,
  isDone,
  nextAction,
  waitingOn,
  type OfficeAside,
  type OfficeStep,
} from "@/lib/office/steps";
import type { CurrencyCode } from "@/lib/rates/catalog";
import { createClient } from "@/lib/supabase/client";
import type { Order } from "@/lib/supabase/types";

export type TodayJob = {
  order: Order;
  customerName: string | null;
  /** Where the foreign leg has to go — only present once it is time to send. */
  destination: { nickname: string; holder: string; number: string; country: string } | null;
};

const STEP_ICON: Record<OfficeStep, typeof Check> = {
  claim: HandCoins,
  accept: ThumbsUp,
  money_in: HandCoins,
  sent: Send,
  settle: Check,
};

/**
 * The only screen an exchange office needs on an ordinary day.
 *
 * One card per job, one big button per card, and a sentence that says what
 * happened rather than what state the row is in — the operator never sees the
 * word `foreign_leg_pending`, they see "ارز را بفرست". The number they need to
 * act on is the largest thing on the card, because that is what they will check
 * against their own screen or their own till.
 *
 * The awkward path — a problem, a question — is a small text link, not a second
 * button. Two equal buttons is a decision; one button and a link is an
 * instruction, and an instruction is what this person wants.
 */
export function Today({ officeId, jobs }: { officeId: string; jobs: TodayJob[] }) {
  const t = useTranslations("officePanel");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const reduce = useReducedMotion();

  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [asideFor, setAsideFor] = React.useState<string | null>(null);
  const [note, setNote] = React.useState("");

  const todo = jobs.filter((j) => nextAction(j.order.state) !== null && !isDone(j.order.state));
  const waiting = jobs.filter((j) => nextAction(j.order.state) === null && !isDone(j.order.state));

  async function act(job: TodayJob, step: OfficeStep | OfficeAside, reason?: string) {
    setBusy(job.order.id);
    setError(null);
    const supabase = createClient();

    const { error: rpcError } =
      step === "claim"
        ? await supabase.rpc("order_claim", { p_order: job.order.id, p_office: officeId })
        : await supabase.rpc("office_step", {
            p_order: job.order.id,
            p_step: step,
            p_reason: reason ?? null,
          });

    setBusy(null);
    if (rpcError) {
      setError(
        /already claimed/i.test(rpcError.message)
          ? t("errors.alreadyClaimed")
          : /short note/i.test(rpcError.message)
            ? t("errors.needNote")
            : t("errors.failed"),
      );
      return;
    }
    setAsideFor(null);
    setNote("");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="flex items-start gap-1.5 rounded-xl bg-down/10 p-3 text-sm text-down-ink">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}

      {todo.length === 0 && waiting.length === 0 ? (
        <Card className="glass flex flex-col items-center gap-4 p-14 text-center [--glass-tint:var(--up)]">
          <AppTile hue="teal" size="xl">
            <Coffee />
          </AppTile>
          <p className="text-lg font-semibold">{t("allClear")}</p>
          <p className="max-w-sm text-sm text-ink-600">{t("allClearBody")}</p>
        </Card>
      ) : null}

      <AnimatePresence initial={false}>
        {todo.map((job) => {
          const action = nextAction(job.order.state)!;
          const Icon = STEP_ICON[action.step];
          const beat = beatOf(job.order.state);
          const send = job.order.send_currency as CurrencyCode;
          const receive = job.order.receive_currency as CurrencyCode;

          // Beat 2 is "money should arrive"; beat 3 is "money must go out".
          // Showing the wrong leg is how an operator sends the wrong amount.
          const focusCurrency = action.step === "money_in" ? ("IRT" as CurrencyCode) : receive;
          const focusMinor =
            action.step === "money_in"
              ? job.order.send_currency === "IRT"
                ? job.order.send_amount_minor
                : job.order.receive_amount_minor
              : job.order.receive_amount_minor;

          return (
            <motion.div
              key={job.order.id}
              layout={!reduce}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, scale: 0.98 }}
              transition={reduce ? { duration: 0 } : { duration: 0.25, ease: EASE_IN }}
            >
              <Card className="glass overflow-hidden [--glass-tint:var(--brand-600)]">
                <div className="flex flex-wrap items-center gap-4 p-5 sm:p-6">
                  <CoinIcon code={action.step === "money_in" ? send : receive} size={56} />
                  <div className="min-w-0 flex-1">
                    <p className="num text-3xl font-bold tracking-tight">
                      {formatAmount(fromMinor(focusMinor, focusCurrency), focusCurrency, locale)}{" "}
                      <span className="text-lg font-medium text-ink-600">{focusCurrency}</span>
                    </p>
                    <p className="mt-1 text-sm text-ink-600">
                      {t(`line.${action.step}`, {
                        name: job.customerName ?? t("aCustomer"),
                        country: job.destination?.country ?? "",
                      })}
                    </p>
                  </div>
                  <Link
                    href={`/orders/${job.order.id}`}
                    className="num font-mono text-xs text-ink-600 hover:text-brand-700"
                    dir="ltr"
                  >
                    {job.order.public_ref}
                  </Link>
                </div>

                {/* Where the money has to go. Only at the moment it matters. */}
                {action.step === "sent" && job.destination ? (
                  <DestinationStrip
                    destination={job.destination}
                    label={t("sendTo")}
                    copyLabel={t("copy")}
                  />
                ) : null}

                <div className="flex items-center gap-2 px-5 pb-2 sm:px-6">
                  <Beats current={beat} label={t("beat", { n: beat })} />
                  <span className="text-xs text-ink-600">{t("beat", { n: beat })}</span>
                </div>

                <div className="space-y-2 p-5 pt-2 sm:p-6 sm:pt-2">
                  <Button
                    size="lg"
                    className="h-14 w-full text-base"
                    disabled={busy === job.order.id}
                    onClick={() => act(job, action.step)}
                  >
                    <Icon className="size-5" aria-hidden />
                    {busy === job.order.id ? t("working") : t(`act.${action.key}`)}
                  </Button>

                  {asideFor === job.order.id ? (
                    <div className="space-y-2 rounded-xl bg-canvas p-3">
                      <label htmlFor={`note-${job.order.id}`} className="text-sm font-medium">
                        {t("whatIsWrong")}
                      </label>
                      <Input
                        id={`note-${job.order.id}`}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder={t("notePlaceholder")}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          disabled={note.trim().length < 3 || busy === job.order.id}
                          onClick={() => act(job, "ask", note.trim())}
                        >
                          {t("askCustomer")}
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={note.trim().length < 3 || busy === job.order.id}
                          onClick={() => act(job, "hold", note.trim())}
                        >
                          {t("pause")}
                        </Button>
                        <Button variant="ghost" onClick={() => setAsideFor(null)}>
                          {t("nevermind")}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setAsideFor(job.order.id);
                        setNote("");
                      }}
                      className="w-full rounded-lg py-2 text-sm text-ink-600 underline-offset-4 hover:text-ink-900 hover:underline"
                    >
                      {t("somethingWrong")}
                    </button>
                  )}
                </div>
              </Card>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {waiting.length > 0 ? (
        <div className="space-y-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink-600">
            {t("waitingTitle")}
            <InfoHint title={t("waitingTitle")} body={t("waitingHint")} />
          </h2>
          {waiting.map((job) => {
            const who = waitingOn(job.order.state);
            const receive = job.order.receive_currency as CurrencyCode;
            return (
              <Card
                key={job.order.id}
                className="glass flex flex-wrap items-center gap-3 p-4 [--glass-tint:var(--ink-600)]"
              >
                <CoinIcon code={receive} size={32} />
                <p className="num flex-1 text-sm font-medium">
                  {formatAmount(
                    fromMinor(job.order.receive_amount_minor, receive),
                    receive,
                    locale,
                  )}{" "}
                  {receive}
                </p>
                <p className="text-sm text-ink-600">
                  {who ? t(`waiting.${who}`) : t("waiting.platform")}
                </p>
                {/* Nothing is asked of this office here, which is exactly why
                    the row still has to open: "why is this one stuck" is the
                    question a waiting list produces. */}
                <Link
                  href={`/orders/${job.order.id}`}
                  className="num font-mono text-xs text-ink-600 hover:text-brand-700"
                  dir="ltr"
                >
                  {job.order.public_ref}
                </Link>
              </Card>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/** Four dots. Where we are in the transfer, without a word of jargon. */
function Beats({ current, label }: { current: number; label: string }) {
  return (
    <span className="flex items-center gap-1.5" role="img" aria-label={label}>
      {[1, 2, 3, 4].map((n) => (
        <span
          key={n}
          className={`size-2 rounded-full ${n <= current ? "bg-brand-600" : "bg-ink-300"}`}
        />
      ))}
    </span>
  );
}

function DestinationStrip({
  destination,
  label,
  copyLabel,
}: {
  destination: NonNullable<TodayJob["destination"]>;
  label: string;
  copyLabel: string;
}) {
  const [copied, setCopied] = React.useState(false);

  return (
    <div className="border-y border-ink-300/40 bg-canvas px-5 py-4 sm:px-6">
      <p className="text-xs font-medium text-ink-600">{label}</p>
      <p className="mt-1 font-semibold">{destination.holder}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <code className="num min-w-0 flex-1 truncate font-mono text-sm" dir="ltr">
          {destination.number}
        </code>
        <Button
          variant="secondary"
          size="sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(destination.number);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              // Clipboard can be blocked; the number is selectable on screen.
            }
          }}
        >
          {copied ? (
            <Check className="size-4" aria-hidden />
          ) : (
            <Copy className="size-4" aria-hidden />
          )}
          {copyLabel}
        </Button>
      </div>
    </div>
  );
}
