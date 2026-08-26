"use client";

import { CircleAlert, Coins, HandCoins } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import * as React from "react";
import { GoldIcon } from "@/components/brand/gold";
import { AppTile } from "@/components/brand/app-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PanelSection } from "@/components/layout/panel-section";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { COINS, type CoinCode } from "@/lib/coins/catalog";
import { formatAmount, toLatinDigits, type AppLocale } from "@/lib/money/format";
import { createClient } from "@/lib/supabase/client";
import type { CoinOrder, CoinState } from "@/lib/supabase/types";

/** What each state can become, from the office's side. */
const NEXT: Partial<Record<CoinState, CoinState>> = {
  confirmed: "paid",
  paid: "ready",
  ready: "collected",
};

const TONE: Record<CoinState, "neutral" | "warn" | "info" | "up" | "down"> = {
  requested: "warn",
  confirmed: "info",
  paid: "info",
  ready: "up",
  collected: "neutral",
  cancelled: "down",
};

/**
 * The office's coin requests, in the order they need attention.
 *
 * Built to the same rule as the rest of this panel: one obvious button per row,
 * and the button says what happens rather than naming a state. A clerk moving
 * a request along should never have to work out which of five words is the one
 * that means "I have taken the money".
 *
 * Confirmation is the only step that asks for anything, and it asks for the one
 * thing only the office knows: the price it will actually honour. It is
 * pre-filled with what the customer was quoted so the common case is one tap.
 */
export function CoinQueue({
  orders,
  officeId,
  locale,
  canAct,
  scope,
}: {
  orders: CoinOrder[];
  /** The office acting. Null in the admin console, which only observes. */
  officeId: string | null;
  locale: AppLocale;
  canAct: boolean;
  scope: "office" | "platform";
}) {
  const t = useTranslations("coins");
  const tq = useTranslations("coinQueue");
  const router = useRouter();

  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [prices, setPrices] = React.useState<Record<string, string>>({});

  async function claim(order: CoinOrder) {
    if (!officeId) return;
    setBusy(order.id);
    setError(null);
    const { error: rpcError } = await createClient().rpc("coin_order_claim", {
      p_order: order.id,
      p_office: officeId,
    });
    setBusy(null);
    if (rpcError) {
      setError(tq("errors.taken"));
      return;
    }
    router.refresh();
  }

  async function advance(order: CoinOrder, to: CoinState, note?: string) {
    setBusy(order.id);
    setError(null);
    const { error: rpcError } = await createClient().rpc("coin_order_advance", {
      p_order: order.id,
      p_to: to,
      p_note: note ?? null,
    });
    setBusy(null);
    if (rpcError) {
      setError(tq("errors.failed"));
      return;
    }
    router.refresh();
  }

  if (orders.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-3 p-10 text-center">
        <AppTile hue="amber" size="lg">
          <Coins />
        </AppTile>
        <p className="text-sm text-ink-600">{tq("empty")}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-ink-600">{tq(`intro.${scope}`)}</p>

      <PanelSection title={tq("title")} hint={tq(`hint.${scope}`)} bodyClassName="space-y-3">
        <ul className="list-rise space-y-3">
          {orders.map((order, i) => {
            const code = order.product as CoinCode;
            const known = code in COINS;
            const next = NEXT[order.state];
            const unclaimed = order.office_id === null;
            const priceDraft =
              prices[order.id] ?? String(order.unit_price_minor ?? order.quoted_unit_minor);

            return (
              <li
                key={order.id}
                style={{ "--i": i } as React.CSSProperties}
                className="space-y-3 rounded-xl border border-ink-300/55 p-4"
              >
                <div className="flex flex-wrap items-center gap-3">
                  {known ? <GoldIcon code={code} size={40} /> : null}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {known ? t(`products.${code}`) : order.product} ×{" "}
                      {order.quantity.toLocaleString(locale === "fa" ? "fa-IR" : "en-US")}
                    </p>
                    <p className="font-mono text-xs text-ink-600" dir="ltr">
                      {order.public_ref}
                    </p>
                  </div>
                  <Badge variant={TONE[order.state]}>{t(`state.${order.state}`)}</Badge>
                </div>

                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <div className="flex justify-between gap-2">
                    <dt className="text-ink-600">{tq("quoted")}</dt>
                    <dd className="num">{formatAmount(order.quoted_unit_minor, "IRT", locale)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-ink-600">{tq("total")}</dt>
                    <dd className="num font-semibold">
                      {formatAmount(order.total_minor, "IRT", locale)}
                    </dd>
                  </div>
                </dl>

                {order.pickup_note ? (
                  <p className="text-sm text-ink-600">
                    {tq("pickup")}: {order.pickup_note}
                  </p>
                ) : null}

                {canAct ? (
                  <div className="flex flex-wrap items-end gap-2">
                    {unclaimed ? (
                      <Button disabled={busy === order.id} onClick={() => claim(order)}>
                        <HandCoins className="size-4" aria-hidden />
                        {tq("claim")}
                      </Button>
                    ) : order.state === "requested" ? (
                      <>
                        <label className="text-sm font-medium">
                          {tq("firmPrice")}
                          <Input
                            dir="ltr"
                            inputMode="numeric"
                            className="mt-1.5 w-48 font-mono"
                            value={priceDraft}
                            onChange={(e) =>
                              setPrices((p) => ({
                                ...p,
                                [order.id]: toLatinDigits(e.target.value).replace(/\D/g, ""),
                              }))
                            }
                          />
                        </label>
                        <Button
                          disabled={busy === order.id || priceDraft === ""}
                          onClick={() => advance(order, "confirmed", priceDraft)}
                        >
                          {tq("confirm")}
                        </Button>
                      </>
                    ) : next ? (
                      <Button disabled={busy === order.id} onClick={() => advance(order, next)}>
                        {tq(`advance.${next}`)}
                      </Button>
                    ) : null}

                    {order.state !== "collected" && order.state !== "cancelled" ? (
                      <Button
                        variant="ghost"
                        disabled={busy === order.id}
                        onClick={() => advance(order, "cancelled", tq("cancelledByOffice"))}
                      >
                        {tq("cancel")}
                      </Button>
                    ) : null}
                  </div>
                ) : null}

                {order.cancel_reason ? (
                  <p className="text-sm text-ink-600">{order.cancel_reason}</p>
                ) : null}
              </li>
            );
          })}
        </ul>

        {error ? (
          <p className="flex items-start gap-1.5 text-sm text-down">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error}
          </p>
        ) : null}
      </PanelSection>
    </div>
  );
}
