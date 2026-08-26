"use client";

import { ArrowUpRight, Landmark, TriangleAlert } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { CoinIcon } from "@/components/brand/coin";
import { Card } from "@/components/ui/card";
import { InfoHint } from "@/components/ui/info-hint";
import { Link } from "@/i18n/navigation";
import { formatAmount, formatNumber, type AppLocale } from "@/lib/money/format";
import { fromMinor } from "@/lib/money/minor";
import { isCurrencyCode, type CurrencyCode } from "@/lib/rates/catalog";

/** One office ledger account collapsed to its net: Σcredit − Σdebit. */
export type LedgerPosition = { currency: string; code: string; netMinor: number };

/** The two codes §17.1 opens for an office; anything else prints as its raw code. */
const CODE_KEYS: Record<string, string> = {
  irt_fees: "liquidity.code.irt_fees",
  irt_settlement: "liquidity.code.irt_settlement",
};

/**
 * What the books say this office is owed (§4.2).
 *
 * The ledger position is the only number here, because it is the only one the
 * system actually keeps: `office_balances.available_minor` and `reserved_minor`
 * are set to zero at provisioning and written by nothing afterwards, and a bold
 * zero labelled «قابل استفاده» is read as "you have no money", not as "this
 * column is not wired up yet".
 *
 * Even the position is not cash in the office's own bank account, which is why
 * the page opens by saying so — an operator who reads it as available cash will
 * pay out money they do not have.
 */
export function LiquidityView({
  currencies,
  positions,
  ledgerVisible,
  truncated,
}: {
  currencies: string[];
  positions: LedgerPosition[];
  ledgerVisible: boolean;
  truncated: boolean;
}) {
  const t = useTranslations("officePanel.money");
  const locale = useLocale() as AppLocale;

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
          const rows = positions.filter((p) => p.currency === currency);
          return (
            <Card key={currency} className="space-y-3 p-5">
              <div className="flex items-center gap-3">
                {isCurrencyCode(currency) ? <CoinIcon code={currency} size={40} /> : null}
                <span className="font-mono text-sm" dir="ltr">
                  {currency}
                </span>
                <InfoHint title={currency} body={t("liquidity.currencyHint")} />
                {/* Where a shortfall is actually fixed. A position that reads
                    low is a settlement question, and the page that answers it
                    was two clicks and a memory away. */}
                <Link
                  href="/office/settlement"
                  className="ms-auto inline-flex items-center gap-1 text-xs font-medium text-ink-600 underline-offset-2 hover:text-brand-700 hover:underline dark:hover:text-brand-600"
                >
                  {t("liquidity.openSettlement")}
                  <ArrowUpRight className="size-3.5 rtl:-scale-x-100" aria-hidden />
                </Link>
              </div>

              <div className="border-t border-ink-300/40 pt-3">
                <p className="text-xs font-medium text-ink-600">{t("liquidity.position")}</p>
                {!ledgerVisible ? (
                  <p className="mt-1.5 text-sm text-ink-600">{t("liquidity.ledgerHidden")}</p>
                ) : rows.length === 0 ? (
                  <p className="mt-1.5 text-sm text-ink-600">{t("liquidity.noPosition")}</p>
                ) : (
                  <>
                    <ul className="mt-2 space-y-2">
                      {rows.map((row) => {
                        const key = CODE_KEYS[row.code];
                        return (
                          <li key={row.code} className="flex items-baseline justify-between gap-3">
                            <span
                              className={key ? "text-sm" : "font-mono text-xs"}
                              dir={key ? undefined : "ltr"}
                            >
                              {key ? t(key) : row.code}
                            </span>
                            <span className="num text-xl font-bold tracking-tight tabular-nums">
                              <Money minor={row.netMinor} currency={row.currency} locale={locale} />
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    <p className="mt-2 text-xs text-ink-600">{t("liquidity.positionHint")}</p>
                  </>
                )}
              </div>
            </Card>
          );
        })
      )}

      {truncated ? (
        <div className="flex items-start gap-2.5 rounded-xl bg-warn/12 p-4 text-sm leading-relaxed text-warn-ink">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{t("liquidity.truncated")}</span>
        </div>
      ) : null}

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
