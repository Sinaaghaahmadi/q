"use client";

import { CircleAlert, Inbox } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import * as React from "react";
import { InfoHint } from "@/components/ui/info-hint";
import { CoinIcon } from "@/components/brand/coin";
import { MatchingScene } from "@/components/brand/scenes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatAmount, formatDate, type AppLocale } from "@/lib/money/format";
import { fromMinor } from "@/lib/money/minor";
import { stateTone } from "@/lib/orders/flow";
import type { CurrencyCode } from "@/lib/rates/catalog";
import { createClient } from "@/lib/supabase/client";
import type { Order } from "@/lib/supabase/types";

/**
 * The office inbox: what is unclaimed in the matching pool, and what this
 * office already holds.
 *
 * Claiming is a race — two offices can press at the same moment — and
 * `order_claim` settles it: it takes the row lock, refuses if the order already
 * has an office, and only then assigns and transitions. A loser here gets a
 * plain "already claimed", not a silent no-op.
 */
export function OfficeInbox({
  officeId,
  officeName,
  pool,
  mine,
}: {
  officeId: string;
  officeName: string;
  pool: Order[];
  mine: Order[];
}) {
  const t = useTranslations("office");
  const tOrders = useTranslations("orders");
  const locale = useLocale() as AppLocale;
  const router = useRouter();

  const [claiming, setClaiming] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function claim(orderId: string) {
    setClaiming(orderId);
    setError(null);
    try {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc("order_claim", {
        p_order: orderId,
        p_office: officeId,
      });
      if (rpcError) {
        setError(
          /already claimed/i.test(rpcError.message)
            ? t("errors.alreadyClaimed")
            : /not active/i.test(rpcError.message)
              ? t("errors.officeInactive")
              : t("errors.claimFailed"),
        );
        return;
      }
      router.push(`/orders/${orderId}`);
    } catch {
      setError(t("errors.network"));
    } finally {
      setClaiming(null);
    }
  }

  function Line({ order, action }: { order: Order; action?: React.ReactNode }) {
    const send = order.send_currency as CurrencyCode;
    const receive = order.receive_currency as CurrencyCode;
    return (
      <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
        <CoinIcon code={send} size={34} />
        <div className="min-w-0 flex-1">
          <p className="num font-mono text-sm font-semibold" dir="ltr">
            {order.public_ref}
          </p>
          <p className="num mt-0.5 text-xs text-ink-600">
            {formatDate(order.created_at, locale, { dateStyle: "medium", timeStyle: "short" })}
          </p>
        </div>
        <div className="text-end">
          <p className="num text-sm font-semibold">
            {formatAmount(fromMinor(order.send_amount_minor, send), send, locale)}{" "}
            <span className="text-xs font-normal text-ink-600" dir="ltr">
              {send}
            </span>
          </p>
          <p className="num mt-0.5 text-xs text-ink-600">
            → {formatAmount(fromMinor(order.receive_amount_minor, receive), receive, locale)}{" "}
            <span dir="ltr">{receive}</span>
          </p>
        </div>
        {action ?? (
          <Badge variant={stateTone(order.state)}>{tOrders(`state.${order.state}`)}</Badge>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="mt-1 text-sm text-ink-600">{t("subtitle", { office: officeName })}</p>
      </div>

      {error ? (
        <p className="flex items-start gap-1.5 text-sm text-down">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      ) : null}

      <section className="space-y-3">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          {t("pool")}
          <InfoHint title={t("pool")} body={t("poolHint")} />
        </h2>
        {pool.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 p-8 text-center">
            <MatchingScene size={120} label={t("poolEmpty")} />
            <p className="text-sm text-ink-600">{t("poolEmpty")}</p>
          </Card>
        ) : (
          <Card className="glass divide-y divide-ink-300/40 [--glass-tint:var(--brand-600)]">
            {pool.map((order) => (
              <Line
                key={order.id}
                order={order}
                action={
                  <Button size="sm" disabled={claiming !== null} onClick={() => claim(order.id)}>
                    {claiming === order.id ? t("claiming") : t("claim")}
                  </Button>
                }
              />
            ))}
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          {t("mine")}
          <InfoHint title={t("mine")} body={t("mineHint")} />
        </h2>
        {mine.length === 0 ? (
          <Card className="flex items-center gap-3 p-6 text-sm text-ink-600">
            <Inbox className="size-5 shrink-0" />
            {t("mineEmpty")}
          </Card>
        ) : (
          <Card className="divide-y divide-ink-300/40">
            {mine.map((order) => (
              <a key={order.id} href={`/orders/${order.id}`} className="block hover:bg-canvas">
                <Line order={order} />
              </a>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
