"use client";

import { Handshake, Plus, ShieldCheck, Star } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { formatAmount, formatNumber, type AppLocale } from "@/lib/money/format";
import { fromMinor } from "@/lib/money/minor";
import type { CurrencyCode } from "@/lib/rates/catalog";
import type { P2pOffer, Reputation } from "@/lib/supabase/types";

/** Everything on the board is one currency against Toman (§1). */
function foreignLeg(offer: P2pOffer): CurrencyCode {
  return (
    offer.have_currency === "IRT" ? offer.want_currency : offer.have_currency
  ) as CurrencyCode;
}

export function OfferBoard({
  offers,
  names,
  reputations,
  viewerId,
  verified,
}: {
  offers: P2pOffer[];
  names: Record<string, string>;
  reputations: Reputation[];
  viewerId: string | null;
  verified: boolean;
}) {
  const t = useTranslations("p2p");
  const locale = useLocale() as AppLocale;
  const [pair, setPair] = React.useState<string>("all");

  const reputationByUser = new Map(reputations.map((r) => [r.user_id, r]));
  const pairs = [...new Set(offers.map((o) => foreignLeg(o)))].sort();
  const shown = pair === "all" ? offers : offers.filter((o) => foreignLeg(o) === pair);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild disabled={!verified}>
          <Link href={verified ? "/p2p/new" : "/verify"}>
            <Plus className="size-4" aria-hidden />
            {verified ? t("postOffer") : t("verifyToPost")}
          </Link>
        </Button>
        <span className="flex-1" />
        <FilterChip label={t("allPairs")} active={pair === "all"} onClick={() => setPair("all")} />
        {pairs.map((code) => (
          <FilterChip
            key={code}
            label={code}
            active={pair === code}
            onClick={() => setPair(code)}
          />
        ))}
      </div>

      {shown.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <Handshake className="size-8 text-brand-600" aria-hidden />
          <p className="text-sm text-ink-600">{t("empty")}</p>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {shown.map((offer) => {
            const foreign = foreignLeg(offer);
            const givesForeign = offer.have_currency !== "IRT";
            const reputation = reputationByUser.get(offer.user_id);
            return (
              <li key={offer.id}>
                <Card className="h-full p-5 transition-shadow hover:shadow-e2">
                  <Link href={`/p2p/${offer.id}`} className="block space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm text-ink-600">
                          {givesForeign
                            ? t("sells", { code: foreign })
                            : t("buys", { code: foreign })}
                        </p>
                        <p className="num mt-0.5 text-lg font-bold">
                          {formatAmount(
                            fromMinor(offer.amount_minor, offer.have_currency as CurrencyCode),
                            offer.have_currency as CurrencyCode,
                            locale,
                          )}{" "}
                          <span className="text-sm font-medium text-ink-600">
                            {offer.have_currency}
                          </span>
                        </p>
                      </div>
                      <Badge variant="brand">
                        {formatNumber(Number(offer.rate_value), locale, {
                          maximumFractionDigits: 0,
                        })}
                        <span className="opacity-70">{t("perUnit", { code: foreign })}</span>
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-ink-600">
                      <ShieldCheck className="size-3.5 text-up" aria-hidden />
                      <span>{names[offer.user_id] ?? t("anonymousMaker")}</span>
                      {reputation ? (
                        <>
                          <span aria-hidden>·</span>
                          <span>{t("tradesDone", { count: reputation.trades_completed })}</span>
                          {reputation.rating_avg ? (
                            <span className="flex items-center gap-0.5">
                              <Star className="size-3 fill-current text-warn" aria-hidden />
                              {formatNumber(Number(reputation.rating_avg), locale, {
                                maximumFractionDigits: 1,
                              })}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <span aria-hidden>·</span>
                          <span>{t("newTrader")}</span>
                        </>
                      )}
                      {offer.user_id === viewerId ? (
                        <Badge variant="outline">{t("yours")}</Badge>
                      ) : null}
                    </div>

                    {offer.terms ? (
                      <p className="line-clamp-2 text-sm text-ink-600">{offer.terms}</p>
                    ) : null}
                  </Link>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-sm text-ink-600">{t("escrowNote")}</p>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? "bg-brand-600 text-white" : "bg-ink-300/25 text-ink-600 hover:text-ink-900"
      }`}
    >
      {label}
    </button>
  );
}
