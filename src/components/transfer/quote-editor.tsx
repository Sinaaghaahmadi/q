"use client";

import { ArrowDownUp, Lock, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { CurrencyPicker } from "@/components/home/currency-picker";
import { InfoHint } from "@/components/ui/info-hint";
import { formatAmountInput, parseAmountInput } from "@/lib/money/format";
import type { CurrencyCode } from "@/lib/rates/catalog";
import { cn } from "@/lib/utils";

/**
 * Changing your mind, without going back.
 *
 * The quote used to be fixed the moment you arrived: the amount and the two
 * currencies came in on the URL, and altering any of them meant returning to
 * the home page, retyping, and coming forward again. People do not decide how
 * much to send in one go — they type a number, see what arrives, and adjust.
 * Making them leave the screen to do that is the difference between a
 * calculator and a form.
 *
 * So the same three controls live at the top of the quote. Editing them rewrites
 * the query string, which is what the server component reads, so the quote is
 * still struck on the server against the server's own snapshot — nothing here
 * invents a price. `replace` rather than `push`, because six adjustments should
 * not mean six presses of the back button to leave.
 *
 * One leg is always Toman. That is not a UI convenience: an Iranian exchange
 * office settles in Toman, and a quote between two foreign currencies is a
 * quote nobody here can fill. Picking a foreign currency on the side that
 * already holds one moves Toman across rather than refusing the tap.
 */
export function QuoteEditor({
  from,
  to,
  amount,
}: {
  from: CurrencyCode;
  to: CurrencyCode;
  amount: number;
}) {
  const t = useTranslations("transfer.edit");
  const tConv = useTranslations("converter");
  const router = useRouter();
  const pathname = usePathname();

  const [raw, setRaw] = React.useState(formatAmountInput(amount));
  const [focused, setFocused] = React.useState(false);
  // `router.replace` inside a transition is the only signal that says when the
  // server has finished re-striking the quote — the amount prop arrives with
  // the new render, which is already too late to show a spinner.
  const [pending, startTransition] = React.useTransition();

  // Keep in step when the server sends back a different figure than was typed
  // — a clamped maximum, say — but never while the field has the caret in it.
  React.useEffect(() => {
    if (!focused) setRaw(formatAmountInput(amount));
  }, [amount, focused]);

  const apply = React.useCallback(
    (next: { from?: CurrencyCode; to?: CurrencyCode; amount?: number | null }) => {
      const nextFrom = next.from ?? from;
      const nextTo = next.to ?? to;
      const nextAmount = next.amount === undefined ? amount : next.amount;
      if (nextAmount === null || nextAmount <= 0) return;
      const query = new URLSearchParams({
        from: nextFrom,
        to: nextTo,
        amount: String(nextAmount),
      });
      startTransition(() => router.replace(`${pathname}?${query.toString()}`, { scroll: false }));
    },
    [amount, from, to, pathname, router],
  );

  // 400ms: long enough that typing "1,250,000" is one re-quote rather than
  // seven, short enough that a pause reads as the app keeping up.
  const typed = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (!focused) return;
    const value = parseAmountInput(raw);
    if (value === null || value === amount) return;
    typed.current = value;
    const id = setTimeout(() => apply({ amount: value }), 400);
    return () => clearTimeout(id);
  }, [raw, focused, amount, apply]);

  function pickFrom(code: CurrencyCode) {
    if (code === from) return;
    apply(code !== "IRT" && to !== "IRT" ? { from: code, to: "IRT" } : { from: code });
  }
  function pickTo(code: CurrencyCode) {
    if (code === to) return;
    apply(code !== "IRT" && from !== "IRT" ? { to: code, from: "IRT" } : { to: code });
  }

  return (
    <div className="rounded-2xl border border-ink-300/60 bg-canvas/70 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">{t("title")}</p>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 text-xs text-ink-600 transition-opacity",
            pending ? "opacity-100" : "opacity-0",
          )}
          aria-live="polite"
        >
          <RefreshCw className="size-3.5 animate-spin" aria-hidden />
          {t("recalculating")}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <div className="rounded-xl border border-ink-300/60 bg-surface p-3">
          <label htmlFor="quote-amount" className="text-xs font-medium text-ink-600">
            {t("youSend")}
          </label>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              id="quote-amount"
              inputMode="decimal"
              autoComplete="off"
              dir="ltr"
              value={focused ? raw : formatAmountInput(parseAmountInput(raw))}
              onFocus={() => setFocused(true)}
              onBlur={() => {
                setFocused(false);
                const value = parseAmountInput(raw);
                if (value !== null && value !== amount) apply({ amount: value });
              }}
              onChange={(e) => setRaw(e.target.value)}
              className="num w-full min-w-0 bg-transparent text-start text-xl font-semibold outline-none"
              placeholder="0"
            />
            <CurrencyPicker value={from} onChange={pickFrom} ariaLabel={t("fromCurrency")} />
          </div>
        </div>

        <button
          type="button"
          onClick={() => apply({ from: to, to: from })}
          aria-label={tConv("swap")}
          className="pressable mx-auto flex size-10 items-center justify-center rounded-full border border-ink-300/60 bg-surface text-brand-600 hover:text-brand-700"
        >
          <ArrowDownUp className="size-4 sm:rotate-90" aria-hidden />
        </button>

        <div className="rounded-xl border border-ink-300/60 bg-surface p-3">
          <span className="text-xs font-medium text-ink-600">{t("recipientCurrency")}</span>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs text-ink-600">
              <Lock className="size-3.5" aria-hidden />
              {t("tomanLeg")}
              <InfoHint term="corridor" />
            </span>
            <CurrencyPicker value={to} onChange={pickTo} ariaLabel={t("toCurrency")} />
          </div>
        </div>
      </div>
    </div>
  );
}
