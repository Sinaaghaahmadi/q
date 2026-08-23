"use client";

import { CircleAlert, Minus, Plus, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import * as React from "react";
import { GoldIcon } from "@/components/brand/gold";
import { ChangeChip } from "@/components/rates/change-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";
import {
  COINS,
  COIN_CODES,
  coinBuyPrice,
  coinPremiumPct,
  type CoinCode,
  type CoinSnapshot,
} from "@/lib/coins/catalog";
import { formatAmount, formatNumber, toLatinDigits, type AppLocale } from "@/lib/money/format";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

/**
 * The platform's own spread on gold, in basis points.
 *
 * A single number rather than per-office config, because a customer asking for
 * a coin has not chosen an office yet — the request goes to the pool and the
 * office that takes it fixes the real price at confirmation. This is what the
 * customer is *shown*, and it is deliberately a little above mid so that the
 * confirmed price is more often below the quote than above it. A quote that
 * routinely rises on confirmation is a quote nobody trusts twice.
 */
const DISPLAY_SPREAD_BPS = 150;

/**
 * Buying gold, as a board of glass.
 *
 * Same material as the currency board on purpose: a customer who has learned
 * that a tinted pane is a live price should not have to learn it again one
 * menu item across. The tint here is gold for every product, which is the
 * honest thing — these really are all the same commodity at different weights,
 * and colouring them apart would imply a difference that is not there.
 *
 * The number that earns its place is the premium (حباب): how much more the
 * coin costs than the gold in it, worked out against the gram price sitting two
 * boxes away. It is the first thing any Iranian buyer asks and the last thing a
 * price table usually tells them.
 */
export function CoinsBoard({
  snapshot,
  locale,
  signedIn,
}: {
  snapshot: CoinSnapshot;
  locale: AppLocale;
  signedIn: boolean;
}) {
  const t = useTranslations("coins");
  const [buying, setBuying] = React.useState<CoinCode | null>(null);

  const gram = snapshot.quotes.GERAM18;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="mt-1 text-sm leading-relaxed text-ink-600">{t("subtitle")}</p>
      </div>

      {snapshot.stale ? (
        <p className="flex items-start gap-2 rounded-xl bg-warn/12 p-3 text-sm text-warn-ink">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t(snapshot.source === "demo" ? "demoNotice" : "staleNotice")}
        </p>
      ) : null}

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {COIN_CODES.map((code, index) => {
          const quote = snapshot.quotes[code];
          const premium = coinPremiumPct(quote, gram, code);
          const meta = COINS[code];

          return (
            <li key={code} style={{ "--i": index } as React.CSSProperties}>
              <div
                className="glass glass-sheen glass-lift flex h-full flex-col gap-3 p-4"
                style={{ "--glass-tint": "#d8a63e" } as React.CSSProperties}
              >
                <div className="flex items-start gap-3">
                  <GoldIcon code={code} size={48} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{t(`products.${code}`)}</p>
                    <p className="text-xs text-ink-600">
                      {t("fine", {
                        grams: formatNumber(meta.fineGrams, locale, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }),
                      })}
                    </p>
                  </div>
                  {quote ? <ChangeChip pct={quote.changePct24h} locale={locale} /> : null}
                </div>

                {quote ? (
                  <div>
                    <p className="num text-xl font-semibold">
                      {formatAmount(coinBuyPrice(quote.mid, DISPLAY_SPREAD_BPS), "IRT", locale)}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-600">{t("perUnit")}</p>
                  </div>
                ) : (
                  <p className="text-sm text-ink-600">{t("noPrice")}</p>
                )}

                {premium !== null ? (
                  <Badge variant={premium > 25 ? "warn" : "neutral"} className="self-start">
                    {t("premium", {
                      pct: formatNumber(premium, locale, { maximumFractionDigits: 1 }),
                    })}
                  </Badge>
                ) : null}

                <div className="mt-auto pt-1">
                  {quote ? (
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => setBuying(code)}
                      disabled={snapshot.source === "demo"}
                    >
                      {t("buy")}
                    </Button>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="text-xs leading-relaxed text-ink-600">{t("disclaimer")}</p>

      <Sheet open={buying !== null} onClose={() => setBuying(null)} title={t("request.title")}>
        {buying ? (
          <BuyForm
            code={buying}
            unitPrice={coinBuyPrice(snapshot.quotes[buying]?.mid ?? 0, DISPLAY_SPREAD_BPS)}
            locale={locale}
            signedIn={signedIn}
            onDone={() => setBuying(null)}
          />
        ) : null}
      </Sheet>
    </div>
  );
}

/**
 * Asking for coins.
 *
 * Deliberately a *request*, not a purchase. Nothing is charged here and no
 * stock is committed: an office picks it up, checks it actually holds what was
 * asked for, and fixes a price. The copy says so in the first line, because a
 * button that says "buy" and a flow that means "ask" is how people end up
 * standing at a counter that has nothing for them.
 */
function BuyForm({
  code,
  unitPrice,
  locale,
  signedIn,
  onDone,
}: {
  code: CoinCode;
  unitPrice: number;
  locale: AppLocale;
  signedIn: boolean;
  onDone: () => void;
}) {
  const t = useTranslations("coins");
  const router = useRouter();

  const [quantity, setQuantity] = React.useState(1);
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [reference, setReference] = React.useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data: id, error: rpcError } = await supabase.rpc("coin_order_create", {
      p_payload: {
        product: code,
        quantity,
        // Recorded as what the customer was shown, never as what they will pay.
        quoted_unit_minor: unitPrice,
        pickup_note: note.trim() || null,
      } as unknown as Json,
    });
    if (rpcError || !id) {
      setBusy(false);
      setError(t("request.failed"));
      return;
    }
    const { data: row } = await supabase
      .from("coin_orders")
      .select("public_ref")
      .eq("id", id)
      .maybeSingle();
    setBusy(false);
    setReference(row?.public_ref ?? null);
    router.refresh();
  }

  if (!signedIn) {
    return (
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-ink-600">{t("request.signInFirst")}</p>
        <Button asChild className="w-full">
          <Link href="/signin?next=/coins">{t("request.signIn")}</Link>
        </Button>
      </div>
    );
  }

  if (reference) {
    return (
      <div className="space-y-4">
        <p className="text-sm leading-relaxed">{t("request.placed")}</p>
        <p
          className="rounded-xl bg-brand-50/70 p-4 text-center font-mono text-lg font-semibold"
          dir="ltr"
        >
          {reference}
        </p>
        <p className="text-sm leading-relaxed text-ink-600">{t("request.next")}</p>
        <Button className="w-full" onClick={onDone}>
          {t("request.done")}
        </Button>
      </div>
    );
  }

  const total = unitPrice * quantity;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <GoldIcon code={code} size={52} />
        <div>
          <p className="font-semibold">{t(`products.${code}`)}</p>
          <p className="num text-sm text-ink-600">
            {formatAmount(unitPrice, "IRT", locale)} · {t("perUnit")}
          </p>
        </div>
      </div>

      <p className="rounded-xl bg-info/10 p-3 text-sm leading-relaxed text-info-ink">
        {t("request.notPaidYet")}
      </p>

      <div>
        <p className="text-sm font-medium">{t("request.quantity")}</p>
        <div className="mt-2 flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            aria-label={t("request.fewer")}
            disabled={quantity <= 1}
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          >
            <Minus className="size-4" aria-hidden />
          </Button>
          <Input
            dir="ltr"
            inputMode="numeric"
            className="w-20 text-center font-mono"
            value={String(quantity)}
            onChange={(e) => {
              const n = Number(toLatinDigits(e.target.value).replace(/\D/g, ""));
              setQuantity(Math.max(1, Math.min(100, Number.isFinite(n) && n > 0 ? n : 1)));
            }}
          />
          <Button
            variant="secondary"
            size="sm"
            aria-label={t("request.more")}
            disabled={quantity >= 100}
            onClick={() => setQuantity((q) => Math.min(100, q + 1))}
          >
            <Plus className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      <label className="block text-sm font-medium">
        {t("request.pickup")}
        <Input
          className="mt-1.5"
          value={note}
          placeholder={t("request.pickupPlaceholder")}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>

      <div className="flex items-baseline justify-between rounded-xl border border-ink-300/55 p-4">
        <span className="text-sm text-ink-600">{t("request.estimate")}</span>
        <span className="num text-lg font-semibold">{formatAmount(total, "IRT", locale)}</span>
      </div>

      <Button className="w-full" disabled={busy} onClick={submit}>
        {busy ? t("request.working") : t("request.cta")}
      </Button>

      {error ? (
        <p className={cn("flex items-start gap-1.5 text-sm text-down")}>
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}
    </div>
  );
}
