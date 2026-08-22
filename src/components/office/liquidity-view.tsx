"use client";

import { Landmark } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { CoinIcon } from "@/components/brand/coin";
import { Card } from "@/components/ui/card";
import { formatAmount, formatNumber, type AppLocale } from "@/lib/money/format";
import { fromMinor } from "@/lib/money/minor";
import { isCurrencyCode, type CurrencyCode } from "@/lib/rates/catalog";
import type { OfficeBalance } from "@/lib/supabase/types";

/** One office ledger account collapsed to its net: Σdebit − Σcredit. */
export type LedgerPosition = { currency: string; code: string; netMinor: number };

/** The two codes §17.1 opens for an office; anything else prints as its raw code. */
const CODE_KEYS: Record<string, string> = {
  irt_fees: "liquidity.code.irt_fees",
  irt_settlement: "liquidity.code.irt_settlement",
};

/**
 * What the office has, and what the books say it is owed (§4.2).
 *
 * Two numbers that are easy to confuse sit side by side here on purpose: the
 * balance is money the platform is holding against this office, the ledger
 * position is the double-entry record behind it. Neither is cash in the
 * office's own bank account, which is why the page opens by saying so — an
 * operator who reads this as available cash will pay out money they do not
 * have.
 */
export function LiquidityView({
  balances,
  positions,
}: {
  balances: OfficeBalance[];
  positions: LedgerPosition[];
}) {
  const t = useTranslations("officePanel.money");
  const locale = useLocale() as AppLocale;

  const currencies = [
    ...new Set([...balances.map((b) => b.currency), ...positions.map((p) => p.currency)]),
  ].sort();

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2.5 rounded-xl bg-info/12 p-4 text-sm leading-relaxed text-info-ink">
        <Landmark className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>{t("liquidity.holding")}</span>
      </div>

      {currencies.length === 0 ? (
        <Card className="p-10 text-center text-sm text-ink-600">{t("liquidity.empty")}</Card>
      ) : (
        currencies.map((currency) => {
          const balance = balances.find((b) => b.currency === currency) ?? null;
          const rows = positions.filter((p) => p.currency === currency);
          return (
            <Card key={currency} className="space-y-4 p-5">
              <div className="flex items-center gap-3">
                {isCurrencyCode(currency) ? <CoinIcon code={currency} size={40} /> : null}
                <span className="font-mono text-sm" dir="ltr">
                  {currency}
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-ink-600">{t("liquidity.available")}</p>
                  <p className="num mt-1 text-2xl font-bold tracking-tight">
                    <Money
                      minor={balance?.available_minor ?? 0}
                      currency={currency}
                      locale={locale}
                    />
                  </p>
                </div>
                <div>
                  <p className="text-xs text-ink-600">{t("liquidity.reserved")}</p>
                  <p className="num mt-1 text-2xl font-bold tracking-tight">
                    <Money
                      minor={balance?.reserved_minor ?? 0}
                      currency={currency}
                      locale={locale}
                    />
                  </p>
                  <p className="mt-1 text-xs text-ink-600">{t("liquidity.reservedHint")}</p>
                </div>
              </div>

              <div className="border-t border-ink-300/40 pt-3">
                <p className="text-xs font-medium text-ink-600">{t("liquidity.position")}</p>
                {rows.length === 0 ? (
                  <p className="mt-1.5 text-sm text-ink-600">{t("liquidity.noPosition")}</p>
                ) : (
                  <ul className="mt-1.5 space-y-1.5 text-sm">
                    {rows.map((row) => {
                      const key = CODE_KEYS[row.code];
                      return (
                        <li key={row.code} className="flex items-center justify-between gap-3">
                          <span
                            className={key ? undefined : "font-mono text-xs"}
                            dir={key ? undefined : "ltr"}
                          >
                            {key ? t(key) : row.code}
                          </span>
                          <span className="num tabular-nums">
                            <Money minor={row.netMinor} currency={row.currency} locale={locale} />
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <p className="mt-2 text-xs text-ink-600">{t("liquidity.positionHint")}</p>
              </div>
            </Card>
          );
        })
      )}

      <p className="text-sm text-ink-600">{t("liquidity.readOnly")}</p>
    </div>
  );
}

/**
 * A currency the catalog does not know has no decimals to divide by, so its
 * minor units are shown as they are stored rather than guessed at.
 */
function Money({
  minor,
  currency,
  locale,
}: {
  minor: number;
  currency: string;
  locale: AppLocale;
}) {
  const code: CurrencyCode | null = isCurrencyCode(currency) ? currency : null;
  return (
    <>{code ? formatAmount(fromMinor(minor, code), code, locale) : formatNumber(minor, locale)}</>
  );
}
