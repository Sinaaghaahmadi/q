"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { CoinIcon } from "@/components/brand/coin";
import { ChangeChip } from "@/components/rates/change-chip";
import { Sparkline } from "@/components/rates/sparkline";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { useRateHistory, useRates } from "@/lib/hooks/use-rates";
import { formatRate, type AppLocale } from "@/lib/money/format";
import { TOP_CORRIDORS, type CurrencyCode } from "@/lib/rates/catalog";
import type { RatesSnapshot } from "@/lib/rates/types";

interface RateStripProps {
  initialSnapshot?: RatesSnapshot;
}

/** Top-6 corridors strip (§7.3): 3D coin, price, 24h chip, micro-sparkline. */
export function RateStrip({ initialSnapshot }: RateStripProps) {
  const t = useTranslations();
  const locale = useLocale() as AppLocale;
  const { data } = useRates();
  const snapshot = data ?? initialSnapshot;
  const bases = TOP_CORRIDORS as CurrencyCode[];
  const { data: history } = useRateHistory(bases, 30);

  return (
    <section aria-label={t("home.stripTitle")}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("home.stripTitle")}</h2>
        <Link href="/rates" className="text-sm font-medium text-brand-600 hover:text-brand-700">
          {t("home.allRates")}
        </Link>
      </div>
      <div className="-mx-4 scrollbar-none flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3 xl:grid-cols-6">
        {bases.map((code) => {
          const quote = snapshot?.rates[code];
          const points = history?.series[code]?.points.map((p) => p.c) ?? [];
          const tone =
            quote && quote.changePct24h > 0.005
              ? "up"
              : quote && quote.changePct24h < -0.005
                ? "down"
                : "neutral";
          return (
            <Link key={code} href="/rates" className="snap-start">
              <Card className="min-w-44 p-4 transition-shadow hover:shadow-e2 sm:min-w-0">
                <div className="flex items-center gap-2.5">
                  <CoinIcon code={code} size={34} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{t(`currencies.${code}`)}</p>
                    <p className="text-xs text-ink-600" dir="ltr">
                      {code}
                    </p>
                  </div>
                </div>
                <div className="mt-3 space-y-1.5">
                  {quote ? (
                    <p className="num text-xl leading-none font-semibold">
                      {formatRate(quote.mid, locale)}
                      <span className="ms-1 text-xs font-normal text-ink-600">
                        {t("converter.toman")}
                      </span>
                    </p>
                  ) : (
                    <Skeleton className="h-6 w-24" />
                  )}
                  <div className="flex items-end justify-between gap-2">
                    {quote ? (
                      <ChangeChip pct={quote.changePct24h} locale={locale} />
                    ) : (
                      <Skeleton className="h-5 w-14" />
                    )}
                    {points.length > 1 ? (
                      <Sparkline points={points} width={72} height={26} tone={tone} />
                    ) : (
                      <Skeleton className="h-6 w-18" />
                    )}
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
