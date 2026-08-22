"use client";

import { CircleAlert, Gavel, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { formatAmount, formatNumber, type AppLocale } from "@/lib/money/format";
import { fromMinor } from "@/lib/money/minor";
import type { CurrencyCode } from "@/lib/rates/catalog";
import { createClient } from "@/lib/supabase/client";
import type { Order, P2pOffer, P2pTrade } from "@/lib/supabase/types";

/**
 * §4.3 /admin/p2p: listings moderation and dispute resolution. Removing a
 * listing is `p2p_offer_close`, which records it as a platform removal rather
 * than a maker cancellation — the trail should say who ended it and why.
 */
export function P2pModeration({
  offers,
  trades,
  disputed,
}: {
  offers: P2pOffer[];
  trades: P2pTrade[];
  disputed: Order[];
}) {
  const t = useTranslations("admin.p2p");
  const locale = useLocale() as AppLocale;
  const router = useRouter();

  const [target, setTarget] = React.useState<string | null>(null);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const tradesByOffer = new Map<string, number>();
  for (const trade of trades) {
    tradesByOffer.set(trade.offer_id, (tradesByOffer.get(trade.offer_id) ?? 0) + 1);
  }

  async function remove(offerId: string) {
    setBusy(true);
    setError(null);
    const { error: rpcError } = await createClient().rpc("p2p_offer_close", {
      p_offer: offerId,
      p_reason: reason.trim() || null,
    });
    setBusy(false);
    if (rpcError) {
      setError(t("removeFailed"));
      return;
    }
    setTarget(null);
    setReason("");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label={t("openOffers")} value={offers.filter((o) => o.status === "open").length} />
        <Stat
          label={t("liveTrades")}
          value={trades.filter((tr) => tr.state === "in_progress").length}
        />
        <Stat
          label={t("disputes")}
          value={disputed.length}
          tone={disputed.length > 0 ? "warn" : "neutral"}
        />
      </div>

      {disputed.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("disputesTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {disputed.map((order) => (
              <div
                key={order.id}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <Link
                  href={`/orders/${order.id}`}
                  className="font-mono text-xs hover:text-brand-700"
                  dir="ltr"
                >
                  {order.public_ref}
                </Link>
                <span className="num">
                  {formatAmount(fromMinor(order.send_amount_minor, "IRT"), "IRT", locale)} IRT
                </span>
                <Button variant="secondary" size="sm" asChild>
                  <Link href={`/admin/orders?state=disputed`}>
                    <Gavel className="size-4" aria-hidden />
                    {t("resolve")}
                  </Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("listings")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {offers.length === 0 ? (
            <p className="text-sm text-ink-600">{t("noListings")}</p>
          ) : (
            offers.map((offer) => {
              const have = offer.have_currency as CurrencyCode;
              return (
                <div
                  key={offer.id}
                  className="space-y-2 border-b border-ink-300/30 pb-3 last:border-0"
                >
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Link
                      href={`/p2p/${offer.id}`}
                      className="font-mono text-xs hover:text-brand-700"
                      dir="ltr"
                    >
                      {offer.have_currency}→{offer.want_currency}
                    </Link>
                    <span className="num">
                      {formatAmount(fromMinor(offer.amount_minor, have), have, locale)} {have}
                    </span>
                    <span className="num text-ink-600">
                      @{" "}
                      {formatNumber(Number(offer.rate_value), locale, { maximumFractionDigits: 0 })}
                    </span>
                    <Badge variant={offer.status === "open" ? "up" : "neutral"}>
                      {t(`status.${offer.status}`)}
                    </Badge>
                    <span className="text-xs text-ink-600">
                      {t("tradesOnOffer", { count: tradesByOffer.get(offer.id) ?? 0 })}
                    </span>
                    <span className="flex-1" />
                    {offer.status === "open" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setTarget(target === offer.id ? null : offer.id);
                          setReason("");
                          setError(null);
                        }}
                      >
                        <Trash2 className="size-4" aria-hidden />
                        {t("remove")}
                      </Button>
                    ) : null}
                  </div>

                  {target === offer.id ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        className="max-w-md"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder={t("removeReason")}
                        aria-label={t("removeReason")}
                      />
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={busy || reason.trim().length < 8}
                        onClick={() => remove(offer.id)}
                      >
                        {t("confirmRemove")}
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}

          {error ? (
            <p className="flex items-start gap-1.5 text-sm text-down">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {error}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "warn" | "neutral" }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-ink-600">{label}</p>
      <p className={`mt-2 text-2xl font-bold tabular-nums ${tone === "warn" ? "text-warn" : ""}`}>
        {value}
      </p>
    </Card>
  );
}
