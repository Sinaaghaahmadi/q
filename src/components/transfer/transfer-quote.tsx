"use client";

import { CircleHelp, RefreshCw, Send, TrendingDown } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import * as React from "react";
import { RateLockScene } from "@/components/brand/scenes/money";
import { PageHeading } from "@/components/brand/app-tile";
import { CoinIcon } from "@/components/brand/coin";
import { RateStatus } from "@/components/rates/rate-status";
import { CommissionBreakdown } from "@/components/transfer/commission-breakdown";
import { QuoteEditor } from "@/components/transfer/quote-editor";
import { InfoHint } from "@/components/ui/info-hint";
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
import { nextBand } from "@/lib/rates/commission";
import type { QuoteResult } from "@/lib/rates/pricing";
import type { RatesSnapshot } from "@/lib/rates/types";
import { toMinor } from "@/lib/money/minor";
import { createClient } from "@/lib/supabase/client";
import type { BeneficiaryAccount } from "@/lib/supabase/types";

const LOCK_SECONDS = 15 * 60;

/** How far this visitor has got towards being able to submit. */
export type TransferGate = "anonymous" | "unverified" | "no_accounts" | "ready";

interface TransferQuoteProps {
  quote: QuoteResult;
  from: CurrencyCode;
  to: CurrencyCode;
  snapshot: RatesSnapshot;
  gate: TransferGate;
  accounts: BeneficiaryAccount[];
}

export function TransferQuote({ quote, from, to, snapshot, gate, accounts }: TransferQuoteProps) {
  const t = useTranslations("transfer");
  const tPricing = useTranslations("pricing");
  const locale = useLocale() as AppLocale;
  const router = useRouter();

  /*
   * The lock is a deadline, not a counter.
   *
   * It used to be `useState(LOCK_SECONDS)` with an interval subtracting one a
   * second, which is wrong twice. A background tab has its timers throttled, so
   * a phone left in a pocket for twenty minutes came back still showing minutes
   * left on a rate that had died — on the one screen where a stale price costs
   * somebody money. And because the countdown was client state, nothing that
   * produced a *new* quote ever reset it: `router.refresh()` deliberately keeps
   * client state, so the "get a new rate" button re-rendered the page and left
   * the clock sitting at 00:00 with both submit buttons still disabled. It did
   * nothing a person could see, which is exactly how it was reported.
   *
   * A timestamp fixes both: the remaining seconds are derived from the wall
   * clock on every tick, and starting a new lock is one assignment.
   */
  const [lockUntil, setLockUntil] = React.useState<number | null>(null);
  const [remaining, setRemaining] = React.useState(LOCK_SECONDS);
  const [requoting, setRequoting] = React.useState(false);
  const [requoteError, setRequoteError] = React.useState<string | null>(null);
  const [refreshing, startRefresh] = React.useTransition();
  const [whyOpen, setWhyOpen] = React.useState(false);
  const [bandsOpen, setBandsOpen] = React.useState(false);
  const [gateOpen, setGateOpen] = React.useState(false);
  const [destination, setDestination] = React.useState(accounts[0]?.id ?? "");
  const [creating, setCreating] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);

  /**
   * Creates the draft and submits it in one go.
   *
   * The draft is inserted directly — RLS allows a customer to create one of
   * their own and nothing else — and every state change after that goes through
   * `order_advance`, which re-derives the actor and re-checks the rules. The
   * lock carried onto the order is what is *left* of the countdown, not a fresh
   * fifteen minutes: silently extending a rate the customer already watched
   * expire would be the dishonest version.
   */
  async function submitOrder() {
    setCreating(true);
    setCreateError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setCreateError(t("createErrors.signedOut"));
        return;
      }

      const { data: created, error: insertError } = await supabase
        .from("orders")
        .insert({
          customer_id: user.id,
          corridor: `${from}-${to}`,
          send_currency: from,
          send_amount_minor: toMinor(quote.sendAmount, from),
          receive_currency: to,
          receive_amount_minor: toMinor(quote.receiveAmount, to),
          locked_rate: String(quote.customerRateToman),
          rate_locked_at: new Date().toISOString(),
          // What is *left* of the countdown, carried onto the order — not a
          // fresh fifteen minutes. The deadline is the honest source for it.
          rate_expires_at: new Date(lockUntil ?? Date.now()).toISOString(),
          platform_fee_minor: toMinor(quote.platformFeeToman, "IRT"),
          office_fee_minor: toMinor(quote.officeFeeToman, "IRT"),
          spread_breakdown: quote.layers,
          // The public mid this quote was struck against, so a completed
          // order can state its cost against a benchmark later (§17.11).
          benchmark_rate: String(quote.midToman),
          destination_account_id: destination,
          state: "draft",
        })
        .select("id")
        .single();

      if (insertError || !created) {
        setCreateError(t("createErrors.failed"));
        return;
      }

      const { error: rpcError } = await supabase.rpc("order_advance", {
        p_order: created.id,
        p_to: "submitted",
      });
      if (rpcError) {
        // The draft exists either way, so send them to it rather than losing it.
        router.push(`/orders/${created.id}`);
        return;
      }
      router.push(`/orders/${created.id}`);
    } catch {
      setCreateError(t("createErrors.network"));
    } finally {
      setCreating(false);
    }
  }

  /*
   * A new quote is a new lock.
   *
   * This covers the two ways the numbers on this screen can change: the amount
   * editor replaces the URL with a different amount, and a re-quote pulls a
   * different rate. Both re-render this component while keeping its state, so
   * without this an edited quote inherited the old countdown — and an edit made
   * after expiry arrived already dead, with no way out but reloading the page.
   *
   * It also sets the first lock, on the client. Computing the deadline during
   * server rendering would start the clock when the page was rendered rather
   * than when it was seen, and hand the browser the server's clock besides.
   */
  const quoteKey = `${from}:${to}:${quote.sendAmount}:${quote.customerRateToman}`;
  React.useEffect(() => {
    setLockUntil(Date.now() + LOCK_SECONDS * 1000);
  }, [quoteKey]);

  React.useEffect(() => {
    if (lockUntil === null) return;
    const tick = () => setRemaining(Math.max(0, Math.ceil((lockUntil - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lockUntil]);

  /**
   * Get a new rate.
   *
   * `router.refresh()` alone is not enough and cannot even tell you it failed:
   * it returns nothing, rejects nothing, and preserves client state, so a
   * re-quote that never reached the server looked identical to one that did.
   * The rates endpoint is asked first — it is the part that can answer "the
   * server did not respond", and it leaves the server-side snapshot warm for
   * the render that follows. Then the page re-renders with the new price, and
   * the lock starts again whether or not the price actually moved: fifteen
   * minutes is a promise about time, not about the number changing.
   */
  async function requote() {
    setRequoteError(null);
    setRequoting(true);
    try {
      const response = await fetch("/api/rates", { cache: "no-store" });
      if (!response.ok) throw new Error(String(response.status));
      setLockUntil(Date.now() + LOCK_SECONDS * 1000);
      startRefresh(() => router.refresh());
    } catch {
      setRequoteError(t("requoteFailed"));
    } finally {
      setRequoting(false);
    }
  }

  const busy = requoting || refreshing;
  const expired = remaining === 0;
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const clock = locale === "fa" ? toPersianDigits(`${mm}:${ss}`) : `${mm}:${ss}`;

  const foreign = from === "IRT" ? to : from;

  /*
   * "Send a little more and the rate drops" — the honest version of a savings
   * banner.
   *
   * This screen used to compare itself against an assumed walk-in counter
   * spread. With the commission stated as a band that comparison was doing
   * nothing but flattering us with a number the reader could not check. The
   * band edge is checkable: it is on the schedule, one tap away, and it is
   * information the customer can act on rather than a claim they have to trust.
   */
  const upgrade = nextBand(quote.tomanLeg, quote.commission.discountPct);
  const worthShowing =
    upgrade !== null &&
    quote.tomanLeg > 0 &&
    // Within a third of the edge. Telling somebody sending two million that
    // three hundred million would be cheaper is not advice, it is noise.
    upgrade.atToman - quote.tomanLeg < quote.tomanLeg * 0.34;

  const pct = (value: number) =>
    formatNumber(value, locale, { maximumFractionDigits: 2, minimumFractionDigits: 0 });
  const money = (value: number) => formatNumber(Math.round(value), locale);

  const rows = [
    {
      key: "youSend",
      value: `${formatAmount(quote.sendAmount, from, locale)} ${from === "IRT" ? t("toman") : from}`,
      coin: from,
    },
    {
      key: "rateUsed",
      hint: quote.spreadBps > 0 ? "rateMarkup" : "midRate",
      value: t("rateValue", {
        rate: formatRate(quote.customerRateToman, locale),
        code: foreign,
      }),
      action:
        quote.spreadBps > 0 ? (
          <button
            type="button"
            onClick={() => setWhyOpen(true)}
            className="inline-flex items-center gap-1 text-xs font-medium text-info hover:underline"
          >
            <CircleHelp className="size-3.5" />
            {t("whyThisRate")}
          </button>
        ) : null,
    },
    {
      // One fee line, not two. What the office keeps and what the platform
      // keeps is a split of this number, not an extra charge, and putting both
      // on a receipt made a customer add up two figures to learn one.
      key: "commission",
      hint: "commission",
      value: `− ${money(quote.commission.toman)} ${t("toman")}`,
      note: t("commissionRate", { pct: pct(quote.commission.effectivePct) }),
      action: (
        <button
          type="button"
          onClick={() => setBandsOpen(true)}
          className="inline-flex items-center gap-1 text-xs font-medium text-info hover:underline"
        >
          <CircleHelp className="size-3.5" />
          {t("howCommission")}
        </button>
      ),
    },
  ] as const;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeading
        hue="brand"
        icon={<Send />}
        title={t("title")}
        subtitle={t("subtitle")}
        action={<RateStatus snapshot={snapshot} />}
      />

      <QuoteEditor from={from} to={to} amount={quote.sendAmount} />

      <Card className="overflow-hidden">
        {/* Rate lock preview: visible countdown, one-tap re-quote. */}
        <div className="flex items-center justify-between gap-4 border-b border-ink-300/40 bg-canvas/60 p-5">
          {/* Hidden on a phone, where the countdown ring and the sentence
              already fill the row. */}
          {expired ? null : <RateLockScene size={76} className="hidden sm:block" />}
          <div className="space-y-1">
            <p className="text-sm font-semibold">{expired ? t("lockExpired") : t("lockActive")}</p>
            <p className="max-w-sm text-xs leading-relaxed text-ink-600">{t("lockNote")}</p>
            {expired ? (
              <>
                <Button size="sm" variant="soft" className="mt-2" disabled={busy} onClick={requote}>
                  <RefreshCw className={busy ? "size-4 animate-spin" : "size-4"} />
                  {busy ? t("requoting") : t("requote")}
                </Button>
                {requoteError ? (
                  <p className="mt-1.5 text-xs leading-relaxed text-down">{requoteError}</p>
                ) : null}
              </>
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
            <div key={row.key} className="flex items-start justify-between gap-3 px-5 py-3.5">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-600">
                {/* The word, then the `i`. Nothing on this receipt is a term
                    somebody has to already know to read the number beside it. */}
                {"hint" in row && row.hint ? (
                  <InfoHint term={row.hint} label={t(row.key)} />
                ) : (
                  t(row.key)
                )}
                {"action" in row ? row.action : null}
              </span>
              <span className="shrink-0 text-end">
                <span className="num inline-flex items-center gap-2 text-sm font-semibold">
                  {"coin" in row && row.coin ? <CoinIcon code={row.coin} size={22} /> : null}
                  {row.value}
                </span>
                {"note" in row && row.note ? (
                  <span className="num mt-0.5 block text-xs text-ink-600">{row.note}</span>
                ) : null}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 bg-brand-50/50 px-5 py-4 dark:bg-brand-50/30">
            <InfoHint
              term="commissionCeiling"
              label={<span className="text-sm font-semibold">{t("recipientGets")}</span>}
            />
            <span className="num inline-flex items-center gap-2 text-xl font-bold">
              <CoinIcon code={to} size={26} />
              {formatAmount(quote.receiveAmount, to, locale)} {to === "IRT" ? t("toman") : to}
            </span>
          </div>
        </div>
      </Card>

      {worthShowing && upgrade ? (
        <button
          type="button"
          onClick={() => setBandsOpen(true)}
          className="flex w-full items-start gap-2 rounded-xl bg-up/10 px-4 py-3 text-start text-sm text-ink-900"
        >
          <TrendingDown className="mt-0.5 size-4 shrink-0 text-up" aria-hidden />
          <span className="num">
            {t("nextBand", {
              amount: money(upgrade.atToman),
              pct: pct(upgrade.effectivePct),
            })}
          </span>
        </button>
      ) : null}

      {gate === "ready" ? (
        <Card className="space-y-3 p-5">
          <label htmlFor="destination" className="text-sm font-semibold">
            {t("destination")}
          </label>
          <select
            id="destination"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="h-11 w-full rounded-xl border border-ink-300 bg-surface px-3 text-sm focus:border-brand-600 focus:ring-2 focus:ring-brand-600/25 focus:outline-none"
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.nickname} — {account.holder_name}
              </option>
            ))}
          </select>
          {createError ? <p className="text-sm text-down">{createError}</p> : null}
        </Card>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        {gate === "ready" ? (
          <Button
            size="lg"
            className="flex-1"
            disabled={expired || creating || !destination}
            onClick={submitOrder}
          >
            {creating ? t("creating") : t("confirmCta")}
          </Button>
        ) : (
          <Button size="lg" className="flex-1" disabled={expired} onClick={() => setGateOpen(true)}>
            {t("confirmCta")}
          </Button>
        )}
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

      {/* The whole schedule, with the reached bands filled in. */}
      <Dialog open={bandsOpen} onOpenChange={setBandsOpen}>
        <DialogContent className="p-6">
          <DialogTitle className="text-base font-semibold">{t("howCommission")}</DialogTitle>
          <DialogDescription className="sr-only">{tPricing("bands.intro")}</DialogDescription>
          <div className="mt-3">
            <CommissionBreakdown commission={quote.commission} locale={locale} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Auth gate */}
      <Dialog open={gateOpen} onOpenChange={setGateOpen}>
        <DialogContent className="p-6">
          <DialogTitle className="text-base font-semibold">{t(`gate.${gate}.title`)}</DialogTitle>
          <DialogDescription className="mt-2 text-sm leading-relaxed text-ink-600">
            {t(`gate.${gate}.body`)}
          </DialogDescription>
          <Button asChild size="lg" className="mt-5 w-full">
            <Link
              href={
                gate === "anonymous"
                  ? { pathname: "/signin", query: { next: "/verify" } }
                  : gate === "unverified"
                    ? "/verify"
                    : "/accounts"
              }
            >
              {t(`gate.${gate}.cta`)}
            </Link>
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
