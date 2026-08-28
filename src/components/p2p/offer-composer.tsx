"use client";

import { CircleAlert } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PriceDial } from "@/components/p2p/price-dial";
import { Input } from "@/components/ui/input";
import { InfoHint } from "@/components/ui/info-hint";
import { formatNumber, type AppLocale } from "@/lib/money/format";
import { toMinor } from "@/lib/money/minor";
import { CURRENCY_CODES, type CurrencyCode } from "@/lib/rates/catalog";
import { useRates } from "@/lib/hooks/use-rates";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/types";

const FOREIGN: CurrencyCode[] = CURRENCY_CODES.filter((c) => c !== "IRT");

/**
 * Post an offer (§9). The side is expressed as a plain sentence rather than a
 * `have`/`want` toggle — "I have EUR, I want Toman" is how people actually
 * think about it, and the corridor rule (§1) means the other leg is always
 * Toman anyway.
 */
export function OfferComposer({ limits }: { limits: Json | null }) {
  const t = useTranslations("p2p.compose");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const rates = useRates();

  const [direction, setDirection] = React.useState<"sell" | "buy">("sell");
  const [currency, setCurrency] = React.useState<CurrencyCode>("EUR");
  const [amount, setAmount] = React.useState("");
  const [rate, setRate] = React.useState("");
  const [minSlice, setMinSlice] = React.useState("");
  const [terms, setTerms] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const market = rates.data?.rates[currency]?.mid ?? null;
  const amountValue = Number(amount);
  const rateValue = Number(rate);
  const ready = amountValue > 0 && rateValue > 0;

  // Selling the foreign leg means `have` is the foreign currency; buying flips it.
  const haveCurrency = direction === "sell" ? currency : "IRT";
  const wantCurrency = direction === "sell" ? "IRT" : currency;
  const haveAmount = direction === "sell" ? amountValue : amountValue * rateValue;

  async function publish() {
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const payload = {
        have_currency: haveCurrency,
        want_currency: wantCurrency,
        amount_minor: toMinor(haveAmount, haveCurrency as CurrencyCode),
        min_slice_minor: minSlice ? toMinor(Number(minSlice), haveCurrency as CurrencyCode) : null,
        rate_mode: "fixed",
        rate_value: rateValue,
        reference_rate: market,
        terms: terms.trim() || null,
      };
      const { data, error: rpcError } = await supabase.rpc("p2p_offer_publish", {
        p_payload: payload as unknown as Json,
      });
      if (rpcError || !data) {
        setError(readable(rpcError?.message ?? ""));
        return;
      }
      router.push(`/p2p/${data}`);
      router.refresh();
    } catch {
      setError(t("errors.failed"));
    } finally {
      setBusy(false);
    }
  }

  function readable(raw: string): string {
    if (/already have an open offer/i.test(raw)) return t("errors.duplicate");
    if (/maximum number of open offers/i.test(raw)) return t("errors.tooMany");
    if (/too many offers/i.test(raw)) return t("errors.cooldown");
    if (/above the ceiling/i.test(raw)) return t("errors.ceiling");
    if (/identity must be verified/i.test(raw)) return t("errors.unverified");
    if (/one leg .* must be Toman/i.test(raw)) return t("errors.corridor");
    if (/bps from the market mid/i.test(raw)) return t("errors.outsideBand");
    return t("errors.failed");
  }

  return (
    <Card className="space-y-5 p-6">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t("direction")}</legend>
        <div className="flex gap-2">
          {(["sell", "buy"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setDirection(value)}
              aria-pressed={direction === value}
              className={`flex-1 rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
                direction === value
                  ? "border-brand-600 bg-brand-50 text-brand-700 dark:text-brand-600"
                  : "border-ink-300 text-ink-600 hover:border-ink-600/40"
              }`}
            >
              {t(value, { code: currency })}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">
          {t("currency")}
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
            className="mt-1.5 h-11 w-full rounded-xl border border-ink-300 bg-surface px-3 text-sm focus:border-brand-600 focus:ring-2 focus:ring-brand-600/25 focus:outline-none"
          >
            {FOREIGN.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>

        <div>
          <label htmlFor="p2p-amount" className="text-sm font-medium">
            {t("amount", { code: currency })}
          </label>
          <Input
            id="p2p-amount"
            dir="ltr"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1.5"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="p2p-rate" className="text-sm font-medium">
            {t("rate", { code: currency })}
          </label>
          <Input
            id="p2p-rate"
            dir="ltr"
            inputMode="numeric"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className="mt-1.5"
          />
          <div className="mt-3">
            <PriceDial direction={direction} market={market} rate={rate} onRate={setRate} />
          </div>
        </div>

        <div>
          <label htmlFor="p2p-min" className="text-sm font-medium">
            {t("minSlice")}
          </label>
          <Input
            id="p2p-min"
            dir="ltr"
            inputMode="decimal"
            value={minSlice}
            onChange={(e) => setMinSlice(e.target.value)}
            className="mt-1.5"
          />
        </div>

        <div>
          <label htmlFor="p2p-terms" className="text-sm font-medium">
            {t("terms")}
          </label>
          <Input
            id="p2p-terms"
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            className="mt-1.5"
            placeholder={t("termsPlaceholder")}
          />
        </div>
      </div>

      {ready ? (
        <p className="rounded-xl bg-canvas p-3 text-sm">
          {t("summary", {
            have: `${formatNumber(haveAmount, locale)} ${haveCurrency}`,
            want: wantCurrency,
            rate: formatNumber(rateValue, locale, { maximumFractionDigits: 0 }),
          })}
        </p>
      ) : null}

      <p className="flex flex-wrap items-center gap-1.5 text-sm text-ink-600">
        {t("escrowNote")}
        <InfoHint term="escrow" />
      </p>

      <Button disabled={!ready || busy} onClick={publish}>
        {busy ? t("publishing") : t("publish")}
      </Button>

      {error ? (
        <p className="flex items-start gap-1.5 text-sm text-down">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}

      {limits ? null : null}
    </Card>
  );
}
