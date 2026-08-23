"use client";

import { ChevronDown, ChevronUp, GripVertical, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { CoinIcon } from "@/components/brand/coin";
import { ChangeChip } from "@/components/rates/change-chip";
import { Sparkline } from "@/components/rates/sparkline";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRate, type AppLocale } from "@/lib/money/format";
import { CURRENCIES, type CurrencyCode } from "@/lib/rates/catalog";
import type { RateQuote } from "@/lib/rates/types";
import { cn } from "@/lib/utils";

/**
 * One currency, as a pane of tinted glass.
 *
 * The tint is the currency's own accent — the flag hue already used by its coin
 * — at a few percent, so a board of twenty reads as one material with twenty
 * temperatures rather than twenty coloured cards. Recognition comes from the
 * coin and the tint together; neither is loud enough alone to be noise.
 *
 * Three things move, and all three are earned:
 *
 *   · a sheen sweeps across once as the box arrives, staggered down the grid,
 *     which is what makes it read as glass instead of as a grey rectangle;
 *   · the box lifts under a pointer, and presses under a finger;
 *   · the figure flashes its direction for a moment when the price actually
 *     changes — the only animation here carrying information rather than
 *     character, so it is the only one that repeats.
 *
 * All of it is CSS. Wiring a motion library into this board cost 39 kB gzipped
 * the last time, against a 215 kB budget, for an entrance animation.
 */
export function RateBox({
  code,
  quote,
  points,
  locale,
  starred,
  onToggleStar,
  onOpen,
  index,
  reordering,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  code: CurrencyCode;
  quote: RateQuote | undefined;
  points: number[];
  locale: AppLocale;
  starred: boolean;
  onToggleStar: () => void;
  onOpen: () => void;
  /** Position in the grid, for the staggered sheen. */
  index: number;
  reordering: boolean;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
}) {
  const t = useTranslations();
  const accent = CURRENCIES[code]?.accent ?? "var(--brand-600)";

  const mid = quote?.mid;
  const previous = React.useRef<number | undefined>(mid);
  const [tick, setTick] = React.useState<"up" | "down" | null>(null);

  React.useEffect(() => {
    const before = previous.current;
    previous.current = mid;
    if (before === undefined || mid === undefined || before === mid) return;
    setTick(mid > before ? "up" : "down");
    const timer = setTimeout(() => setTick(null), 900);
    return () => clearTimeout(timer);
  }, [mid]);

  const tone =
    quote && quote.changePct24h > 0.005
      ? "up"
      : quote && quote.changePct24h < -0.005
        ? "down"
        : "neutral";

  return (
    <div
      style={{ "--i": index, "--glass-tint": accent } as React.CSSProperties}
      draggable={reordering}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(
        "glass glass-sheen relative flex flex-col gap-3 p-4",
        reordering ? "cursor-grab active:cursor-grabbing" : "glass-lift",
      )}
    >
      <div className="flex items-start gap-3">
        <CoinIcon code={code} size={38} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{t(`currencies.${code}`)}</p>
          <p className="text-xs text-ink-600" dir="ltr">
            {code}
          </p>
        </div>

        {reordering ? (
          <span className="text-ink-600" aria-hidden>
            <GripVertical className="size-4" />
          </span>
        ) : (
          <button
            type="button"
            onClick={onToggleStar}
            aria-pressed={starred}
            aria-label={t(starred ? "ratesPage.unfavorite" : "ratesPage.favorite", {
              currency: t(`currencies.${code}`),
            })}
            className="pressable -m-1.5 rounded-lg p-1.5 text-ink-600 hover:bg-ink-300/25"
          >
            <Star className={cn("size-4", starred && "fill-warn text-warn")} />
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={onOpen}
        disabled={reordering}
        className="pressable -m-1 flex items-end justify-between gap-3 rounded-xl p-1 text-start disabled:pointer-events-none"
      >
        <span className="min-w-0">
          {quote ? (
            <>
              <span
                className={cn(
                  "num block text-xl font-semibold transition-colors duration-500",
                  tick === "up" && "text-up",
                  tick === "down" && "text-down",
                )}
              >
                {formatRate(quote.mid, locale)}
              </span>
              <span className="mt-1 flex items-center gap-2">
                <span className="text-xs text-ink-600">{t("converter.toman")}</span>
                <ChangeChip pct={quote.changePct24h} locale={locale} />
              </span>
            </>
          ) : (
            <>
              <Skeleton className="h-7 w-28" />
              <Skeleton className="mt-2 h-5 w-20" />
            </>
          )}
        </span>
        <span className="shrink-0">
          {points.length > 1 ? (
            <Sparkline points={points} width={72} height={30} tone={tone} />
          ) : (
            <Skeleton className="h-7 w-18" />
          )}
        </span>
      </button>

      {/* Arrows rather than drag alone. HTML5 drag does not exist on touch, and
          this app is used on a phone more than anywhere else; the arrows are
          also the only way to reorder from a keyboard. */}
      {reordering ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst}
            aria-label={t("ratesPage.moveUp", { currency: t(`currencies.${code}`) })}
            className="pressable flex-1 rounded-lg border border-ink-300 py-1.5 text-ink-600 disabled:opacity-40"
          >
            <ChevronUp className="mx-auto size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            aria-label={t("ratesPage.moveDown", { currency: t(`currencies.${code}`) })}
            className="pressable flex-1 rounded-lg border border-ink-300 py-1.5 text-ink-600 disabled:opacity-40"
          >
            <ChevronDown className="mx-auto size-4" aria-hidden />
          </button>
        </div>
      ) : null}
    </div>
  );
}
