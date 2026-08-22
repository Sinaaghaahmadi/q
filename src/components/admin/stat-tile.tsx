import { useFormatter, useLocale } from "next-intl";
import * as React from "react";
import { Card } from "@/components/ui/card";
import { formatAmount, type AppLocale } from "@/lib/money/format";
import type { CurrencyCode } from "@/lib/rates/catalog";

/**
 * One number, stated plainly (§2.5: big legible numbers, no chart chrome where
 * a figure will do). `currency` switches to the money formatter so the Toman
 * figures carry their own scale rather than a raw count's.
 */
export function StatTile({
  label,
  value,
  currency,
  tone = "neutral",
}: {
  label: string;
  value: number;
  currency?: CurrencyCode;
  tone?: "neutral" | "warn" | "up";
}) {
  const locale = useLocale() as AppLocale;
  const format = useFormatter();

  const rendered = currency
    ? formatAmount(value, currency, locale)
    : format.number(value, { maximumFractionDigits: 0 });

  return (
    <Card className="p-5">
      <p className="text-sm text-ink-600">{label}</p>
      <p
        className={`mt-2 text-2xl font-bold tabular-nums ${
          tone === "warn" ? "text-warn" : tone === "up" ? "text-up" : ""
        }`}
      >
        {rendered}
        {currency ? (
          <span className="ms-1.5 text-sm font-medium text-ink-600">{currency}</span>
        ) : null}
      </p>
    </Card>
  );
}
