"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowDownUp, MoveLeft, MoveRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { CurrencyPicker } from "@/components/home/currency-picker";
import { RateStatus } from "@/components/rates/rate-status";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InfoHint } from "@/components/ui/info-hint";
import { RollingNumber } from "@/components/ui/rolling-number";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { useRates } from "@/lib/hooks/use-rates";
import {
  formatAmountInput,
  formatRate,
  parseAmountInput,
  type AppLocale,
} from "@/lib/money/format";
import { type CurrencyCode } from "@/lib/rates/catalog";
import type { RatesSnapshot } from "@/lib/rates/types";
import { cn } from "@/lib/utils";

interface ConverterProps {
  initialSnapshot?: RatesSnapshot;
  className?: string;
}

/** Toman per unit; IRT is the anchor with value 1. */
function tomanOf(code: CurrencyCode, snapshot: RatesSnapshot | undefined): number | null {
  if (code === "IRT") return 1;
  const mid = snapshot?.rates[code]?.mid;
  return typeof mid === "number" && mid > 0 ? mid : null;
}

/**
 * The inline converter (§7.3): live recalculation (150ms debounce), spring
 * swap, works logged out, mid-market rate with the final quote deferred to
 * the transfer flow. Phase-1 corridor rule: one leg is always IRT — picking a
 * foreign currency on both legs snaps the other leg back to IRT.
 */
export function Converter({ initialSnapshot, className }: ConverterProps) {
  const t = useTranslations("converter");
  const locale = useLocale() as AppLocale;
  const reduce = useReducedMotion();
  const { data } = useRates();
  const snapshot = data ?? initialSnapshot;

  const [from, setFrom] = React.useState<CurrencyCode>("USD");
  const [to, setTo] = React.useState<CurrencyCode>("IRT");
  const [rawAmount, setRawAmount] = React.useState("1,000");
  const [debounced, setDebounced] = React.useState("1,000");
  const [focused, setFocused] = React.useState(false);
  const [swapCount, setSwapCount] = React.useState(0);
  const prevResult = React.useRef<number | null>(null);
  const [tickDirection, setTickDirection] = React.useState<"up" | "down" | null>(null);

  // 150ms debounce (§7.3) — cheap math, but keeps the digit-roll calm.
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(rawAmount), 150);
    return () => clearTimeout(id);
  }, [rawAmount]);

  const amount = parseAmountInput(debounced);
  const fromToman = tomanOf(from, snapshot);
  const toToman = tomanOf(to, snapshot);
  const rate = fromToman !== null && toToman !== null ? fromToman / toToman : null;
  const result = amount !== null && rate !== null ? amount * rate : null;

  React.useEffect(() => {
    if (result !== null && prevResult.current !== null && result !== prevResult.current) {
      setTickDirection(result > prevResult.current ? "up" : "down");
    }
    prevResult.current = result;
  }, [result]);

  function pickFrom(code: CurrencyCode) {
    setFrom(code);
    if (code !== "IRT" && to !== "IRT") setTo("IRT");
    if (code === "IRT" && to === "IRT") setTo("USD");
  }
  function pickTo(code: CurrencyCode) {
    setTo(code);
    if (code !== "IRT" && from !== "IRT") setFrom("IRT");
    if (code === "IRT" && from === "IRT") setFrom("USD");
  }

  function swap() {
    setSwapCount((c) => c + 1);
    setFrom(to);
    setTo(from);
  }

  const resultText =
    result === null
      ? "—"
      : new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US", {
          maximumFractionDigits: to === "IRT" ? 0 : 2,
        }).format(result);

  const unitRateText =
    rate !== null
      ? t("unitRate", {
          from: from === "IRT" ? t("toman") : from,
          rate: formatRate(rate, locale),
          toUnit: to === "IRT" ? t("toman") : to,
        })
      : null;

  const loading = !snapshot;
  const DirIcon = locale === "fa" ? MoveLeft : MoveRight;

  return (
    <Card className={cn("relative overflow-hidden p-5 shadow-e2 sm:p-6", className)}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{t("title")}</h2>
        <span className="flex items-center gap-2">
          <RateStatus snapshot={snapshot} />
          <InfoHint term="refresh" />
        </span>
      </div>

      <div className="relative space-y-2">
        {/* You send */}
        <motion.div
          layout
          transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 24 }}
          className="rounded-2xl border border-ink-300/60 bg-canvas p-4"
        >
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="conv-amount" className="text-xs font-medium text-ink-600">
              {t("youSend")}
            </label>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <input
              id="conv-amount"
              inputMode="decimal"
              autoComplete="off"
              dir="ltr"
              value={focused ? rawAmount : formatAmountInput(parseAmountInput(rawAmount))}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onChange={(e) => setRawAmount(e.target.value)}
              aria-label={t("youSend")}
              className="num w-full min-w-0 bg-transparent text-start text-2xl font-semibold text-ink-900 outline-none placeholder:text-ink-600/50"
              placeholder="0"
            />
            <CurrencyPicker value={from} onChange={pickFrom} ariaLabel={t("fromCurrency")} />
          </div>
        </motion.div>

        {/* Swap */}
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 flex -translate-y-1/2 justify-center">
          <motion.button
            type="button"
            onClick={swap}
            aria-label={t("swap")}
            animate={reduce ? undefined : { rotate: swapCount * 180 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            className="pointer-events-auto flex size-11 items-center justify-center rounded-full border border-ink-300/60 bg-surface text-brand-600 shadow-e2 transition-colors hover:text-brand-700"
          >
            <ArrowDownUp className="size-5" />
          </motion.button>
        </div>

        {/* Recipient gets */}
        <motion.div
          layout
          transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 24 }}
          className="rounded-2xl border border-brand-600/30 bg-brand-50/60 p-4 dark:bg-brand-50/40"
        >
          <p className="text-xs font-medium text-ink-600">{t("recipientGets")}</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            {loading ? (
              <Skeleton className="h-8 w-36" />
            ) : (
              <RollingNumber
                value={resultText}
                direction={tickDirection}
                className="text-2xl font-semibold"
              />
            )}
            <CurrencyPicker value={to} onChange={pickTo} ariaLabel={t("toCurrency")} />
          </div>
        </motion.div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          {loading ? (
            <Skeleton className="h-4 w-44" />
          ) : unitRateText ? (
            <p className="text-sm text-ink-600">
              <span className="num">{unitRateText}</span>
            </p>
          ) : null}
          {/* The rule and the reason for it, where the two currencies are
              picked rather than in a paragraph further down: one leg is Toman
              because an Iranian exchange office settles in Toman, and a quote
              between two foreign currencies is one nobody here can fill. */}
          <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-ink-600/80">
            <InfoHint term="midRate" label={t("midRateNote")} />
          </p>
          <p className="text-xs text-ink-600/80">{t("tomanLegNote")}</p>
        </div>
        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link
            href={{
              pathname: "/transfer/new",
              query: { from, to, amount: String(amount ?? "") },
            }}
          >
            {t("cta")}
            <DirIcon className="size-4" aria-hidden />
          </Link>
        </Button>
      </div>
    </Card>
  );
}
