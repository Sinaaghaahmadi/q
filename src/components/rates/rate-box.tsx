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
 * One currency, as a pane of tinted glass — and as a row, not a tile.
 *
 * The board used to be a grid of squares, two or three across. Prices in a grid
 * read badly: the eye has to travel down one column and back up the next to
 * compare two numbers, and on a phone the third column was a horizontal scroll
 * nobody found. Stacked full-width rows put every figure on the same left edge
 * with every price on the same right edge, so comparing twenty currencies is
 * one movement down the page.
 *
 * The tint is the currency's own accent — the flag hue already used by its coin
 * — at a few percent, so a board of twenty reads as one material with twenty
 * temperatures rather than twenty coloured cards.
 *
 * Three things move, and all three are earned:
 *
 *   · a sheen sweeps across once as the row arrives, staggered down the list,
 *     which is what makes it read as glass instead of as a grey rectangle;
 *   · the row lifts under a pointer, and presses under a finger;
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
  starred = false,
  onToggleStar,
  onOpen,
  index,
  reordering = false,
  isFirst = false,
  isLast = false,
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
  /** Position in the list, for the staggered sheen. */
  index: number;
  onOpen: () => void;
  /** Starring and reordering belong to the full board; the home list omits them. */
  starred?: boolean;
  onToggleStar?: () => void;
  reordering?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: () => void;
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
        "glass glass-sheen relative flex items-center gap-3 p-3 sm:gap-4 sm:p-4",
        reordering ? "cursor-grab active:cursor-grabbing" : "glass-lift",
      )}
    >
      {/* The row itself is the target: coin, name, trend and price all open the
          same detail sheet, so there is no small tap area to aim at. */}
      <button
        type="button"
        onClick={onOpen}
        disabled={reordering}
        className="pressable -m-1 flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1 text-start disabled:pointer-events-none sm:gap-4"
      >
        <CoinIcon code={code} size={40} />

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{t(`currencies.${code}`)}</span>
          <span className="block text-xs text-ink-600" dir="ltr">
            {code}
          </span>
        </span>

        {/* The trend sits between the name and the price on a wide row and
            steps out of the way on a narrow one, where the price matters more
            than its shape. */}
        <span className="hidden shrink-0 sm:block">
          {points.length > 1 ? (
            <Sparkline points={points} width={80} height={30} tone={tone} />
          ) : (
            <Skeleton className="h-7 w-20" />
          )}
        </span>

        <span className="shrink-0 text-end">
          {quote ? (
            <>
              <span
                className={cn(
                  "num block text-lg leading-tight font-semibold transition-colors duration-500 sm:text-xl",
                  tick === "up" && "text-up",
                  tick === "down" && "text-down",
                )}
              >
                {formatRate(quote.mid, locale)}
              </span>
              <span className="mt-1 flex items-center justify-end gap-2">
                <span className="text-xs text-ink-600">{t("converter.toman")}</span>
                <ChangeChip pct={quote.changePct24h} locale={locale} />
              </span>
            </>
          ) : (
            <>
              <Skeleton className="h-6 w-24" />
              <Skeleton className="ms-auto mt-2 h-5 w-20" />
            </>
          )}
        </span>
      </button>

      {reordering ? (
        <span className="flex shrink-0 flex-col gap-1">
          {/* Arrows rather than drag alone. HTML5 drag does not exist on touch,
              and this app is used on a phone more than anywhere else; the
              arrows are also the only way to reorder from a keyboard. */}
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst}
            aria-label={t("ratesPage.moveUp", { currency: t(`currencies.${code}`) })}
            className="pressable rounded-lg border border-ink-300 px-2 py-1 text-ink-600 disabled:opacity-40"
          >
            <ChevronUp className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            aria-label={t("ratesPage.moveDown", { currency: t(`currencies.${code}`) })}
            className="pressable rounded-lg border border-ink-300 px-2 py-1 text-ink-600 disabled:opacity-40"
          >
            <ChevronDown className="size-4" aria-hidden />
          </button>
          <span className="mx-auto text-ink-600" aria-hidden>
            <GripVertical className="size-4" />
          </span>
        </span>
      ) : onToggleStar ? (
        <button
          type="button"
          onClick={onToggleStar}
          aria-pressed={starred}
          aria-label={t(starred ? "ratesPage.unfavorite" : "ratesPage.favorite", {
            currency: t(`currencies.${code}`),
          })}
          className="pressable -m-1.5 shrink-0 rounded-lg p-1.5 text-ink-600 hover:bg-ink-300/25"
        >
          <Star className={cn("size-4", starred && "fill-warn text-warn")} />
        </button>
      ) : null}
    </div>
  );
}
