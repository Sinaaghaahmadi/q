"use client";

import { CircleAlert, ShieldCheck, Star } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { formatAmount, formatNumber, type AppLocale } from "@/lib/money/format";
import { fromMinor, toMinor } from "@/lib/money/minor";
import type { CurrencyCode } from "@/lib/rates/catalog";
import { createClient } from "@/lib/supabase/client";
import type { P2pOffer, Reputation } from "@/lib/supabase/types";

export function OfferDetail({
  offer,
  makerName,
  reputation,
  myTradeId,
  viewerId,
  verified,
}: {
  offer: P2pOffer;
  makerName: string | null;
  reputation: Reputation | null;
  myTradeId: string | null;
  viewerId: string | null;
  verified: boolean;
}) {
  const t = useTranslations("p2p");
  const locale = useLocale() as AppLocale;
  const router = useRouter();

  const have = offer.have_currency as CurrencyCode;
  const foreign = (
    offer.have_currency === "IRT" ? offer.want_currency : offer.have_currency
  ) as CurrencyCode;
  const rate = Number(offer.rate_value);
  const mine = offer.user_id === viewerId;

  const [slice, setSlice] = React.useState(String(fromMinor(offer.amount_minor, have)));
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const sliceValue = Number(slice);
  const canTake = !mine && verified && offer.status === "open" && sliceValue > 0 && !myTradeId;

  // The Toman side of the slice, so the taker sees what the escrow will hold.
  const tomanSide = offer.have_currency === "IRT" ? sliceValue : Math.round(sliceValue * rate);

  async function take() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("p2p_trade_take", {
      p_offer: offer.id,
      p_amount_minor: toMinor(sliceValue, have),
      p_agreed_rate: rate,
    });
    setBusy(false);
    if (rpcError || !data) {
      setError(readable(rpcError?.message ?? ""));
      return;
    }
    router.push(`/p2p/trades/${data}`);
    router.refresh();
  }

  function readable(raw: string): string {
    if (/your own offer/i.test(raw)) return t("errors.ownOffer");
    if (/below the minimum slice/i.test(raw)) return t("errors.belowMin");
    if (/above the maximum slice/i.test(raw)) return t("errors.aboveMax");
    if (/only .* left/i.test(raw)) return t("errors.notEnoughLeft");
    if (/no active exchange office/i.test(raw)) return t("errors.noEscrow");
    if (/above the ceiling/i.test(raw)) return t("errors.ceiling");
    if (/identity must be verified/i.test(raw)) return t("errors.unverified");
    if (/has expired|that offer is/i.test(raw)) return t("errors.closed");
    return t("errors.failed");
  }

  return (
    <>
      <Card className="space-y-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-ink-600">
              {offer.have_currency !== "IRT"
                ? t("sells", { code: foreign })
                : t("buys", { code: foreign })}
            </p>
            <p className="num mt-1 text-2xl font-bold">
              {formatAmount(fromMinor(offer.amount_minor, have), have, locale)}{" "}
              <span className="text-base font-medium text-ink-600">{have}</span>
            </p>
          </div>
          <Badge variant={offer.status === "open" ? "up" : "neutral"}>
            {t(`status.${offer.status}`)}
          </Badge>
        </div>

        <dl className="space-y-2 text-sm">
          <Row
            label={t("rateLabel", { code: foreign })}
            value={formatNumber(rate, locale, { maximumFractionDigits: 0 })}
          />
          {offer.min_slice_minor ? (
            <Row
              label={t("minSliceLabel")}
              value={`${formatAmount(fromMinor(offer.min_slice_minor, have), have, locale)} ${have}`}
            />
          ) : null}
          <Row label={t("makerLabel")} value={makerName ?? t("anonymousMaker")} />
          <Row
            label={t("reputationLabel")}
            value={
              reputation
                ? t("reputationValue", {
                    count: reputation.trades_completed,
                    rate: formatNumber(Number(reputation.completion_rate), locale, {
                      maximumFractionDigits: 0,
                    }),
                  })
                : t("newTrader")
            }
          />
        </dl>

        {offer.terms ? <p className="text-sm leading-relaxed text-ink-600">{offer.terms}</p> : null}

        <div className="flex flex-wrap items-center gap-2 text-sm text-ink-600">
          <ShieldCheck className="size-4 text-up" aria-hidden />
          {t("escrowNote")}
          {reputation?.rating_avg ? (
            <span className="flex items-center gap-0.5">
              <Star className="size-3.5 fill-current text-warn" aria-hidden />
              {formatNumber(Number(reputation.rating_avg), locale, { maximumFractionDigits: 1 })}
            </span>
          ) : null}
        </div>
      </Card>

      {myTradeId ? (
        <Card className="space-y-3 p-6">
          <p className="text-sm">{t("alreadyTaken")}</p>
          <Button asChild>
            <Link href={`/p2p/trades/${myTradeId}`}>{t("openTrade")}</Link>
          </Button>
        </Card>
      ) : mine ? (
        <Card className="p-6 text-sm text-ink-600">{t("yourOwnOffer")}</Card>
      ) : !verified ? (
        <Card className="space-y-3 p-6">
          <p className="text-sm">{t("verifyToTake")}</p>
          <Button asChild>
            <Link href={viewerId ? "/verify" : "/signin?next=/p2p"}>
              {viewerId ? t("verifyCta") : t("signInCta")}
            </Link>
          </Button>
        </Card>
      ) : (
        <Card className="space-y-4 p-6">
          <h2 className="text-sm font-semibold">{t("takeTitle")}</h2>
          <div>
            <label htmlFor="p2p-slice" className="text-sm font-medium">
              {t("sliceLabel", { code: have })}
            </label>
            <Input
              id="p2p-slice"
              dir="ltr"
              inputMode="decimal"
              value={slice}
              onChange={(e) => setSlice(e.target.value)}
              className="mt-1.5"
            />
          </div>

          {sliceValue > 0 ? (
            <p className="rounded-xl bg-canvas p-3 text-sm">
              {t("takeSummary", {
                toman: formatNumber(tomanSide, locale, { maximumFractionDigits: 0 }),
              })}
            </p>
          ) : null}

          <Button disabled={!canTake || busy} onClick={take}>
            {busy ? t("taking") : t("take")}
          </Button>

          {error ? (
            <p className="flex items-start gap-1.5 text-sm text-down">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {error}
            </p>
          ) : null}
        </Card>
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-ink-300/40 pb-2 last:border-0">
      <dt className="text-ink-600">{label}</dt>
      <dd className="num text-end font-medium">{value}</dd>
    </div>
  );
}
