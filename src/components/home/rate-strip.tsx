"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { RateBox } from "@/components/rates/rate-box";
import { RateStatus } from "@/components/rates/rate-status";
import { InfoHint } from "@/components/ui/info-hint";
import { Link, useRouter } from "@/i18n/navigation";
import { useRateHistory, useRates } from "@/lib/hooks/use-rates";
import { type AppLocale } from "@/lib/money/format";
import { TOP_CORRIDORS, type CurrencyCode } from "@/lib/rates/catalog";
import type { RatesSnapshot } from "@/lib/rates/types";

interface RateStripProps {
  initialSnapshot?: RatesSnapshot;
}

/**
 * The main corridors on the front page, stacked.
 *
 * This was a horizontal scroller of six square cards. Two currencies were
 * visible on a phone and the other four were behind a swipe most people never
 * made — a carousel of prices is a carousel of prices nobody reads. It is now
 * the same rows as the full board, one under the next, so the six numbers are
 * six numbers rather than a gesture to discover.
 */
export function RateStrip({ initialSnapshot }: RateStripProps) {
  const t = useTranslations();
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const { data } = useRates();
  const snapshot = data ?? initialSnapshot;
  const bases = TOP_CORRIDORS as CurrencyCode[];
  const { data: history } = useRateHistory(bases, 30);

  return (
    <section aria-label={t("home.stripTitle")}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t("home.stripTitle")}</h2>
        <div className="flex items-center gap-3">
          {/* Where the numbers come from and how often they move, one tap away
              rather than a sentence under every price. */}
          <RateStatus snapshot={snapshot} />
          <InfoHint term="refresh" />
        </div>
      </div>

      <ul className="grid gap-2.5">
        {bases.map((code, index) => (
          <li key={code}>
            <RateBox
              code={code}
              quote={snapshot?.rates[code]}
              points={history?.series[code]?.points.map((p) => p.c) ?? []}
              locale={locale}
              index={index}
              onOpen={() => router.push("/rates")}
            />
          </li>
        ))}
      </ul>

      <p className="mt-3 text-center">
        <Link href="/rates" className="text-sm font-medium text-brand-600 hover:text-brand-700">
          {t("home.allRates")}
        </Link>
      </p>
    </section>
  );
}
