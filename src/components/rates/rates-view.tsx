"use client";

import { ArrowUpDown, Bell, ChartCandlestick, Check, RotateCcw, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import * as React from "react";
import { PageHeading } from "@/components/brand/app-tile";
import { CoinIcon } from "@/components/brand/coin";
import { RateBoardScene, TrendScene } from "@/components/brand/scenes/market";
import { ChangeChip } from "@/components/rates/change-chip";
import { HistoryChart } from "@/components/rates/history-chart";
import { RateBox } from "@/components/rates/rate-box";
import { RateStatus } from "@/components/rates/rate-status";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { InfoHint } from "@/components/ui/info-hint";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRateOrder } from "@/lib/hooks/use-rate-order";
import { useRateHistory, useRates } from "@/lib/hooks/use-rates";
import { formatRate, type AppLocale } from "@/lib/money/format";
import { FOREIGN_CODES, type CurrencyCode } from "@/lib/rates/catalog";
import type { RatesSnapshot } from "@/lib/rates/types";

/**
 * Loaded only when somebody opens the alert sheet.
 *
 * Alerts need the Supabase client, and importing it here statically put 73 kB
 * gzipped into the rates board — 162 kB to 235 against a 215 budget, caught by
 * `pnpm budget` rather than by a user on a slow connection. The board is the
 * front door and most visitors never set an alert, so the cost belongs to the
 * ones who do.
 */
const AlertManager = dynamic(
  () => import("@/components/rates/alert-manager").then((m) => m.AlertManager),
  { ssr: false },
);

const FAVORITES_KEY = "asaex.rates.favorites";

function useFavorites() {
  const [favorites, setFavorites] = React.useState<CurrencyCode[]>([]);
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(FAVORITES_KEY);
      if (raw) setFavorites(JSON.parse(raw) as CurrencyCode[]);
    } catch {
      // per-viewer convenience only — start empty when storage is unavailable
    }
  }, []);
  const toggle = React.useCallback((code: CurrencyCode) => {
    setFavorites((prev) => {
      const next = prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code];
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);
  return { favorites, toggle };
}

export function RatesView({
  initialSnapshot,
  signedIn = false,
}: {
  initialSnapshot?: RatesSnapshot;
  /** Alerts belong to an account, so the sheet asks for one when there is none. */
  signedIn?: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale() as AppLocale;
  const { data } = useRates();
  const snapshot = data ?? initialSnapshot;
  const { data: history } = useRateHistory([...FOREIGN_CODES], 30);
  const { favorites, toggle } = useFavorites();
  const { order, move, reset } = useRateOrder();
  const [reordering, setReordering] = React.useState(false);
  const dragged = React.useRef<CurrencyCode | null>(null);

  const [query, setQuery] = React.useState("");
  const [detail, setDetail] = React.useState<CurrencyCode | null>(null);
  const [range, setRange] = React.useState<"30" | "90" | "180">("90");
  const { data: detailHistory } = useRateHistory(detail ? [detail] : [], Number(range));
  const [alertOpen, setAlertOpen] = React.useState(false);

  const q = query.trim().toLowerCase();
  const codes = order.filter(
    (c) => !q || c.toLowerCase().includes(q) || t(`currencies.${c}`).toLowerCase().includes(q),
  );
  // Favourites float to the top of the board, but not while it is being
  // rearranged: a box that jumps the moment you star or move it is a box you
  // cannot aim at. In reorder mode the list is exactly the order being edited.
  const sorted = reordering
    ? codes
    : [
        ...codes.filter((c) => favorites.includes(c)),
        ...codes.filter((c) => !favorites.includes(c)),
      ];

  const detailQuote = detail && snapshot ? snapshot.rates[detail] : undefined;
  const detailPoints = detail ? (detailHistory?.series[detail]?.points ?? []) : [];

  return (
    <div className="space-y-5">
      <PageHeading
        hue="brand"
        icon={<ChartCandlestick />}
        title={t("ratesPage.title")}
        subtitle={
          <span className="flex flex-wrap items-center gap-1.5">
            {t("ratesPage.subtitle")}
            <InfoHint term="openMarket" />
          </span>
        }
        action={
          <>
            <RateStatus snapshot={snapshot} />
            <InfoHint term="refresh" />
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-600" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("ratesPage.search")}
            className="ps-9"
          />
        </div>

        <div className="flex gap-2">
          <Button
            variant={reordering ? "primary" : "secondary"}
            size="sm"
            onClick={() => setReordering((v) => !v)}
            aria-pressed={reordering}
          >
            {reordering ? <Check className="size-4" /> : <ArrowUpDown className="size-4" />}
            {t(reordering ? "ratesPage.reorderDone" : "ratesPage.reorder")}
          </Button>
          {reordering ? (
            <Button variant="ghost" size="sm" onClick={reset}>
              <RotateCcw className="size-4" />
              {t("ratesPage.reorderReset")}
            </Button>
          ) : null}
        </div>
      </div>

      {reordering ? (
        <p className="text-sm leading-relaxed text-ink-600">{t("ratesPage.reorderHint")}</p>
      ) : null}

      {sorted.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-8 text-center">
          {/* Searching and finding nothing is a moment, not a list waiting to
              fill — so it gets the drawing rather than the tile. */}
          <RateBoardScene size={128} label={t("ratesPage.noResults")} />
          <p className="text-sm text-ink-600">{t("ratesPage.noResults")}</p>
        </Card>
      ) : (
        <ul className="grid gap-2.5">
          {sorted.map((code, index) => (
            <li key={code}>
              <RateBox
                code={code}
                quote={snapshot?.rates[code]}
                points={history?.series[code]?.points.map((p) => p.c) ?? []}
                locale={locale}
                starred={favorites.includes(code)}
                onToggleStar={() => toggle(code)}
                onOpen={() => setDetail(code)}
                index={index}
                reordering={reordering}
                isFirst={index === 0}
                isLast={index === sorted.length - 1}
                onMoveUp={() => move(code, order.indexOf(code) - 1)}
                onMoveDown={() => move(code, order.indexOf(code) + 1)}
                onDragStart={() => {
                  dragged.current = code;
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  const from = dragged.current;
                  dragged.current = null;
                  if (from && from !== code) move(from, order.indexOf(code));
                }}
              />
            </li>
          ))}
        </ul>
      )}

      {/* Pair detail sheet */}
      <Dialog open={detail !== null} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent variant="sheet" className="p-0 sm:max-w-2xl">
          {detail ? (
            <div className="space-y-4 overflow-y-auto p-5 pe-12">
              <div className="flex items-center gap-3">
                <CoinIcon code={detail} size={44} />
                <div className="flex-1">
                  <DialogTitle className="text-lg font-semibold">
                    {t(`currencies.${detail}`)}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-ink-600" dir="ltr">
                    {detail}/IRT
                  </DialogDescription>
                </div>
                {detailQuote ? <ChangeChip pct={detailQuote.changePct24h} locale={locale} /> : null}
              </div>

              {detailQuote ? (
                <p className="rate-hero">
                  {formatRate(detailQuote.mid, locale)}
                  <span className="ms-2 text-base font-normal text-ink-600">
                    {t("converter.toman")}
                  </span>
                </p>
              ) : (
                <Skeleton className="h-10 w-48" />
              )}

              <div className="flex items-center justify-between gap-3">
                <Tabs value={range} onValueChange={(v) => setRange(v as typeof range)}>
                  <TabsList>
                    <TabsTrigger value="30">{t("ratesPage.range30")}</TabsTrigger>
                    <TabsTrigger value="90">{t("ratesPage.range90")}</TabsTrigger>
                    <TabsTrigger value="180">{t("ratesPage.range180")}</TabsTrigger>
                  </TabsList>
                </Tabs>
                <Button variant="soft" size="sm" onClick={() => setAlertOpen(true)}>
                  <Bell className="size-4" />
                  {t("ratesPage.alertCta")}
                </Button>
              </div>

              {detailPoints.length > 1 ? (
                <HistoryChart points={detailPoints} code={detail ?? undefined} />
              ) : detailHistory ? (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <TrendScene size={112} label={t("ratesPage.noHistory")} />
                  <p className="text-sm text-ink-600">{t("ratesPage.noHistory")}</p>
                </div>
              ) : (
                <Skeleton className="h-52 w-full" />
              )}

              {detailQuote?.high24h && detailQuote.low24h ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-ink-300/50 p-3">
                    <p className="text-xs text-ink-600">{t("ratesPage.high24h")}</p>
                    <p className="num mt-1 text-sm font-semibold">
                      {formatRate(detailQuote.high24h, locale)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-ink-300/50 p-3">
                    <p className="text-xs text-ink-600">{t("ratesPage.low24h")}</p>
                    <p className="num mt-1 text-sm font-semibold">
                      {formatRate(detailQuote.low24h, locale)}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Alerts are real now: the row is the customer's own, and the firing
          happens in the database against recorded snapshots (migration 0029). */}
      <Dialog open={alertOpen} onOpenChange={setAlertOpen}>
        <DialogContent className="p-6">
          <DialogTitle className="text-base font-semibold">
            {t("alerts.title", { currency: detail ? t(`currencies.${detail}`) : "" })}
          </DialogTitle>
          <div className="mt-3">
            {detail ? (
              <AlertManager
                code={detail}
                currentMid={detailQuote?.mid}
                locale={locale}
                signedIn={signedIn}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
