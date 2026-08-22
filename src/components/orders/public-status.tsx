"use client";

import { Check, Clock, ShieldCheck } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { CoinIcon } from "@/components/brand/coin";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { formatAmount, type AppLocale } from "@/lib/money/format";
import { fromMinor } from "@/lib/money/minor";
import { stateTone } from "@/lib/orders/flow";
import type { CurrencyCode } from "@/lib/rates/catalog";
import type { OrderState } from "@/lib/supabase/types";

export type PublicStatusPayload = {
  found: boolean;
  public_ref: string;
  state: OrderState;
  corridor: string;
  receive_currency: string;
  receive_amount_minor: number;
  created_at: string;
  state_since: string;
  sla_target_at: string | null;
  due_at: string | null;
  office_fa: string | null;
  office_en: string | null;
  timeline: { to_state: OrderState; at: string }[];
};

/**
 * Four milestones rather than nineteen states: the recipient is not an operator
 * and does not need the machine, only the answer to "where is my money".
 */
const MILESTONES: { key: string; states: OrderState[] }[] = [
  { key: "accepted", states: ["office_review", "accepted"] },
  { key: "funded", states: ["awaiting_irt_funding", "irt_funded"] },
  { key: "sent", states: ["foreign_leg_pending", "foreign_leg_sent"] },
  { key: "done", states: ["recipient_confirmed", "irt_released", "completed"] },
];

export function PublicStatus({ status }: { status: PublicStatusPayload }) {
  const t = useTranslations("track");
  const states = useTranslations("orders.state");
  const locale = useLocale() as AppLocale;
  const format = useFormatter();

  const receive = status.receive_currency as CurrencyCode;
  const reached = new Set(status.timeline.map((event) => event.to_state));
  const office = locale === "fa" ? status.office_fa : status.office_en;

  function reachedAt(milestone: (typeof MILESTONES)[number]): string | null {
    const hit = status.timeline.find((event) => milestone.states.includes(event.to_state));
    return hit?.at ?? null;
  }

  return (
    <div className="space-y-5">
      <Card className="space-y-4 p-6 text-center">
        <p className="font-mono text-xs text-ink-600" dir="ltr">
          {status.public_ref}
        </p>
        <CoinIcon code={receive} size={64} className="mx-auto" />
        <div>
          <p className="text-sm text-ink-600">{t("arriving")}</p>
          <p className="num mt-1 text-3xl font-bold">
            {formatAmount(fromMinor(status.receive_amount_minor, receive), receive, locale)}{" "}
            <span className="text-lg font-medium text-ink-600">{receive}</span>
          </p>
        </div>
        <Badge variant={stateTone(status.state)}>{states(status.state)}</Badge>
      </Card>

      <Card className="space-y-4 p-6">
        <ol className="space-y-4">
          {MILESTONES.map((milestone) => {
            const at = reachedAt(milestone);
            const done = milestone.states.some((s) => reached.has(s));
            return (
              <li key={milestone.key} className="flex items-start gap-3">
                <span
                  className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2 ${
                    done
                      ? "border-brand-600 bg-brand-solid text-white"
                      : "border-ink-300 text-ink-600"
                  }`}
                  aria-hidden
                >
                  {done ? <Check className="size-3.5" /> : <Clock className="size-3" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${done ? "" : "text-ink-600"}`}>
                    {t(`milestone.${milestone.key}`)}
                  </p>
                  {at ? (
                    <time dateTime={at} className="text-xs text-ink-600">
                      {format.dateTime(new Date(at), { dateStyle: "medium", timeStyle: "short" })}
                    </time>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </Card>

      <Card className="space-y-2 p-6 text-sm">
        {office ? (
          <p className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-up" aria-hidden />
            {t("handledBy", { office })}
          </p>
        ) : null}
        {status.due_at ? (
          <p className="text-ink-600">
            {t("dueBy", {
              date: format.dateTime(new Date(status.due_at), { dateStyle: "medium" }),
            })}
          </p>
        ) : null}
        <p className="text-ink-600">{t("privacyNote")}</p>
      </Card>

      <p className="text-center text-sm text-ink-600">
        {t("cta")}{" "}
        <Link href="/" className="font-medium text-brand-700 underline dark:text-brand-600">
          {t("ctaLink")}
        </Link>
      </p>
    </div>
  );
}
