"use client";

import { CircleHelp, Info, RefreshCw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import * as React from "react";
import { CoinIcon } from "@/components/brand/coin";
import { RateStatus } from "@/components/rates/rate-status";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CountdownRing } from "@/components/ui/countdown-ring";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Link } from "@/i18n/navigation";
import {
  formatAmount,
  formatNumber,
  formatRate,
  toPersianDigits,
  type AppLocale,
} from "@/lib/money/format";
import type { CurrencyCode } from "@/lib/rates/catalog";
import type { QuoteResult } from "@/lib/rates/pricing";
import type { RatesSnapshot } from "@/lib/rates/types";

const LOCK_SECONDS = 15 * 60;
/** Typical street-exchange spread used for the honest savings comparison (§17.11). */
const STREET_SPREAD_BPS = 180;

interface TransferQuoteProps {
  quote: QuoteResult;
  from: CurrencyCode;
  to: CurrencyCode;
  snapshot: RatesSnapshot;
}

export function TransferQuote({ quote, from, to, snapshot }: TransferQuoteProps) {
  const t = useTranslations("transfer");
  const tPricing = useTranslations("pricing");
  const locale = useLocale() as AppLocale;
  const router = useRouter();

  const [remaining, setRemaining] = React.useState(LOCK_SECONDS);
  const [whyOpen, setWhyOpen] = React.useState(false);
  const [gateOpen, setGateOpen] = React.useState(false);

  React.useEffect(() => {
    const id = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  const expired = remaining === 0;
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const clock = locale === "fa" ? toPersianDigits(`${mm}:${ss}`) : `${mm}:${ss}`;

  const foreign = from === "IRT" ? to : from;
  // Honest benchmark: what a typical street exchange (no fee, wider spread)
  // would deliver, valued in Toman at mid.
  let savingsToman = 0;
  if (quote.direction === "irt_to_foreign") {
    const streetAsk = quote.midToman * (1 + STREET_SPREAD_BPS / 10_000);
    const streetReceive = quote.sendAmount / streetAsk;
    savingsToman = (quote.receiveAmount - streetReceive) * quote.midToman;
  } else {
    const streetBid = quote.midToman * (1 - STREET_SPREAD_BPS / 10_000);
    savingsToman = quote.receiveAmount - quote.sendAmount * streetBid;
  }
  savingsToman = Math.max(0, savingsToman);

  const rows = [
    {
      key: "youSend",
      value: `${formatAmount(quote.sendAmount, from, locale)} ${from === "IRT" ? t("toman") : from}`,
      coin: from,
    },
    {
      key: "rateUsed",
      value: t("rateValue", {
        rate: formatRate(quote.customerRateToman, locale),
        code: foreign,
      }),
      action: (
        <button
          type="button"
          onClick={() => setWhyOpen(true)}
          className="inline-flex items-center gap-1 text-xs font-medium text-info hover:underline"
        >
          <CircleHelp className="size-3.5" />
          {t("whyThisRate")}
        </button>
      ),
    },
    {
      key: "platformFee",
      value: `− ${formatNumber(Math.round(quote.platformFeeToman), locale)} ${t("toman")}`,
    },
    {
      key: "officeFee",
      value: `− ${formatNumber(Math.round(quote.officeFeeToman), locale)} ${t("toman")}`,
    },
  ] as const;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="mt-1 text-sm text-ink-600">{t("subtitle")}</p>
        </div>
        <RateStatus snapshot={snapshot} />
      </div>

      <Card className="overflow-hidden">
        {/* Rate lock preview (§7.2): visible countdown, one-tap re-quote. */}
        <div className="flex items-center justify-between gap-4 border-b border-ink-300/40 bg-canvas/60 p-5">
          <div className="space-y-1">
            <p className="text-sm font-semibold">{expired ? t("lockExpired") : t("lockActive")}</p>
            <p className="max-w-sm text-xs leading-relaxed text-ink-600">{t("lockNote")}</p>
            {expired ? (
              <Button size="sm" variant="soft" className="mt-2" onClick={() => router.refresh()}>
                <RefreshCw className="size-4" />
                {t("requote")}
              </Button>
            ) : null}
          </div>
          <CountdownRing
            totalSeconds={LOCK_SECONDS}
            remainingSeconds={remaining}
            size={88}
            label={clock}
          />
        </div>

        {/* Wise-style itemization (§7.2) */}
        <div className="divide-y divide-ink-300/40">
          {rows.map((row) => (
            <div key={row.key} className="flex items-center justify-between gap-3 px-5 py-3.5">
              <span className="flex items-center gap-2 text-sm text-ink-600">
                {t(row.key)}
                {"action" in row ? row.action : null}
              </span>
              <span className="num inline-flex items-center gap-2 text-sm font-semibold">
                {"coin" in row && row.coin ? <CoinIcon code={row.coin} size={22} /> : null}
                {row.value}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 bg-brand-50/50 px-5 py-4 dark:bg-brand-50/30">
            <span className="text-sm font-semibold">{t("recipientGets")}</span>
            <span className="num inline-flex items-center gap-2 text-xl font-bold">
              <CoinIcon code={to} size={26} />
              {formatAmount(quote.receiveAmount, to, locale)} {to === "IRT" ? t("toman") : to}
            </span>
          </div>
        </div>
      </Card>

      {savingsToman > 1000 ? (
        <p className="flex items-start gap-2 rounded-xl bg-up/10 px-4 py-3 text-sm text-ink-900">
          <Info className="mt-0.5 size-4 shrink-0 text-up" />
          {t("savings", { amount: formatNumber(Math.round(savingsToman), locale) })}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button size="lg" className="flex-1" disabled={expired} onClick={() => setGateOpen(true)}>
          {t("confirmCta")}
        </Button>
        <Button asChild size="lg" variant="secondary">
          <Link href="/">{t("back")}</Link>
        </Button>
      </div>
      <p className="text-xs leading-relaxed text-ink-600">{t("slaNote")}</p>

      {/* Why this rate? — spread layers stay visible (§7.2) */}
      <Dialog open={whyOpen} onOpenChange={setWhyOpen}>
        <DialogContent className="p-6">
          <DialogTitle className="text-base font-semibold">{t("whyThisRate")}</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-ink-600">
            {t("whyBody", { rate: formatRate(quote.midToman, locale), code: foreign })}
          </DialogDescription>
          <ul className="mt-4 space-y-2">
            {quote.layers.map((layer) => (
              <li key={layer.key} className="flex items-center justify-between text-sm">
                <span className="text-ink-600">{tPricing(`layers.${layer.key}`)}</span>
                <span className="num font-medium" dir="ltr">
                  {layer.bps > 0 ? "+" : ""}
                  {formatNumber(layer.bps, locale)} bps
                </span>
              </li>
            ))}
            <li className="flex items-center justify-between border-t border-ink-300/40 pt-2 text-sm font-semibold">
              <span>{tPricing("total")}</span>
              <span className="num" dir="ltr">
                {formatNumber(quote.spreadBps, locale)} bps
              </span>
            </li>
          </ul>
        </DialogContent>
      </Dialog>

      {/* Auth gate — honest phase framing (§18) */}
      <Dialog open={gateOpen} onOpenChange={setGateOpen}>
        <DialogContent className="p-6">
          <DialogTitle className="text-base font-semibold">{t("gateTitle")}</DialogTitle>
          <DialogDescription className="mt-2 text-sm leading-relaxed text-ink-600">
            {t("gateBody")}
          </DialogDescription>
          <Button asChild size="lg" className="mt-5 w-full">
            <Link href={{ pathname: "/signin", query: { next: "/verify" } }}>{t("gateCta")}</Link>
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
