"use client";

import { Calculator } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { Card } from "@/components/ui/card";
import { InfoHint } from "@/components/ui/info-hint";
import {
  formatAmountInput,
  formatNumber,
  parseAmountInput,
  type AppLocale,
} from "@/lib/money/format";
import { COMMISSION_BANDS, commissionOn, PLATFORM_SHARE } from "@/lib/rates/commission";

/**
 * The commission schedule, with a box to try an amount in.
 *
 * Both panels need this and they need it for the same reason: somebody on the
 * phone to a customer is asked "what will this cost me?", and the honest answer
 * requires adding up bands. A table alone makes them do that arithmetic in
 * their head at the exact moment they cannot afford to get it wrong, so the
 * table comes with a field: type the amount, read the answer, quote it.
 *
 * `showSplit` is the difference between the two audiences. An exchange office
 * cares what it earns; the platform console cares about both sides of the
 * split. Neither is shown to a customer, for whom the split is not a fact about
 * their transfer — the total is.
 */
export function CommissionSchedule({
  showSplit = false,
  defaultAmount = 100_000_000,
}: {
  showSplit?: boolean;
  defaultAmount?: number;
}) {
  const t = useTranslations("pricing.schedule");
  const tBands = useTranslations("pricing.bands");
  const locale = useLocale() as AppLocale;

  const [raw, setRaw] = React.useState(formatAmountInput(defaultAmount));
  const [focused, setFocused] = React.useState(false);
  const amount = parseAmountInput(raw) ?? 0;
  const result = commissionOn(amount);

  const money = (value: number) => formatNumber(Math.round(value), locale);
  const pct = (value: number) =>
    formatNumber(value, locale, { maximumFractionDigits: 2, minimumFractionDigits: 0 });

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="flex flex-wrap items-center gap-2 text-base font-semibold">
          {t("title")}
          <InfoHint term="commission" />
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-600">{tBands("intro")}</p>
      </div>

      <div className="rounded-xl border border-ink-300/60 bg-canvas/60 p-4">
        <label
          htmlFor="commission-try"
          className="flex items-center gap-1.5 text-xs font-medium text-ink-600"
        >
          <Calculator className="size-3.5" aria-hidden />
          {t("tryLabel")}
        </label>
        <div className="mt-1.5 flex flex-wrap items-baseline gap-2">
          <input
            id="commission-try"
            inputMode="decimal"
            dir="ltr"
            autoComplete="off"
            value={focused ? raw : formatAmountInput(parseAmountInput(raw))}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={(e) => setRaw(e.target.value)}
            className="num min-w-40 flex-1 bg-transparent text-start text-xl font-semibold outline-none"
            placeholder="0"
          />
          <span className="text-xs text-ink-600">{tBands("toman")}</span>
        </div>

        <dl className="mt-3 grid gap-2 border-t border-ink-300/40 pt-3 sm:grid-cols-3">
          <Figure label={t("commission")} value={`${money(result.toman)} ${tBands("toman")}`} />
          <Figure label={t("effective")} value={`${pct(result.effectivePct)}٪`} />
          {showSplit ? (
            <Figure
              label={t("officeShare")}
              value={`${money(result.toman * (1 - PLATFORM_SHARE))} ${tBands("toman")}`}
            />
          ) : (
            <Figure label={t("marginal")} value={`${pct(result.marginalPct)}٪`} />
          )}
        </dl>
      </div>

      <ul className="divide-y divide-ink-300/40 rounded-xl border border-ink-300/50">
        {COMMISSION_BANDS.map((band, index) => {
          const slice = result.slices[index];
          const lower = index === 0 ? 0 : (COMMISSION_BANDS[index - 1]?.upToToman ?? 0);
          return (
            <li
              key={index}
              className={`flex items-center justify-between gap-3 px-3 py-2 text-sm ${
                slice ? "" : "opacity-45"
              }`}
            >
              <span className="num min-w-0 text-xs text-ink-600">
                {band.upToToman === null
                  ? tBands("above", { from: money(lower) })
                  : tBands("between", { from: money(lower), to: money(band.upToToman) })}
              </span>
              <span className="shrink-0 text-end">
                <span className="num text-sm font-semibold">{pct(band.pct)}٪</span>
                {slice ? (
                  <span className="num ms-2 text-xs text-ink-600">{money(slice.tomanCharged)}</span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="text-xs leading-relaxed text-ink-600">
        {showSplit ? t("splitNote", { pct: pct(PLATFORM_SHARE * 100) }) : t("ceilingNote")}
      </p>
    </Card>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-600">{label}</dt>
      <dd className="num mt-0.5 text-base font-semibold">{value}</dd>
    </div>
  );
}
