"use client";

import { useTranslations } from "next-intl";
import * as React from "react";
import { formatNumber, type AppLocale } from "@/lib/money/format";
import { COMMISSION_BANDS, type CommissionResult } from "@/lib/rates/commission";

/**
 * The bands, and which of them this transfer actually reached.
 *
 * A percentage that changes with the amount invites exactly one question — "why
 * that number?" — and the answer is a table. Showing the whole schedule with
 * the reached rows filled in answers it without a paragraph: you can see the
 * band you are in, the ones below it you were charged for, and the cheaper one
 * above that you have not reached.
 */
export function CommissionBreakdown({
  commission,
  locale,
}: {
  commission: CommissionResult;
  locale: AppLocale;
}) {
  const t = useTranslations("pricing.bands");

  const money = (value: number) => formatNumber(Math.round(value), locale);
  const pct = (value: number) =>
    formatNumber(value, locale, { maximumFractionDigits: 2, minimumFractionDigits: 0 });

  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed text-ink-600">{t("intro")}</p>

      <ul className="divide-y divide-ink-300/40 rounded-xl border border-ink-300/50">
        {COMMISSION_BANDS.map((band, index) => {
          const slice = commission.slices[index];
          const reached = Boolean(slice);
          const lower = index === 0 ? 0 : (COMMISSION_BANDS[index - 1]?.upToToman ?? 0);
          return (
            <li
              key={index}
              className={`flex items-center justify-between gap-3 px-3 py-2.5 text-sm ${
                reached ? "" : "opacity-45"
              }`}
            >
              <span className="min-w-0">
                <span className="block font-medium">{pct(band.pct)}٪</span>
                <span className="num block text-xs text-ink-600">
                  {band.upToToman === null
                    ? t("above", { from: money(lower) })
                    : t("between", { from: money(lower), to: money(band.upToToman) })}
                </span>
              </span>
              <span className="num shrink-0 text-end text-sm">
                {reached && slice ? (
                  <>
                    <span className="block font-semibold">{money(slice.tomanCharged)}</span>
                    <span className="block text-xs text-ink-600">{t("toman")}</span>
                  </>
                ) : (
                  <span className="text-xs text-ink-600">{t("notReached")}</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center justify-between gap-3 rounded-xl bg-brand-50/60 px-3 py-2.5 text-sm font-semibold dark:bg-brand-50/40">
        <span>{t("total")}</span>
        <span className="num">
          {money(commission.toman)} {t("toman")} · {pct(commission.effectivePct)}٪
        </span>
      </div>
    </div>
  );
}
