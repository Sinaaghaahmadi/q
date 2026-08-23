"use client";

import { Bell, Search, Star } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { CoinIcon } from "@/components/brand/coin";
import { ChangeChip } from "@/components/rates/change-chip";
import { HistoryChart } from "@/components/rates/history-chart";
import { RateStatus } from "@/components/rates/rate-status";
import { Sparkline } from "@/components/rates/sparkline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRateHistory, useRates } from "@/lib/hooks/use-rates";
import { formatRate, type AppLocale } from "@/lib/money/format";
import { FOREIGN_CODES, type CurrencyCode } from "@/lib/rates/catalog";
import type { RatesSnapshot } from "@/lib/rates/types";
import { cn } from "@/lib/utils";

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

export function RatesView({ initialSnapshot }: { initialSnapshot?: RatesSnapshot }) {
  const t = useTranslations();
  const locale = useLocale() as AppLocale;
  const { data } = useRates();
  const snapshot = data ?? initialSnapshot;
  const { data: history } = useRateHistory([...FOREIGN_CODES], 30);
  const { favorites, toggle } = useFavorites();

  const [query, setQuery] = React.useState("");
  const [detail, setDetail] = React.useState<CurrencyCode | null>(null);
  const [range, setRange] = React.useState<"30" | "90" | "180">("90");
  const { data: detailHistory } = useRateHistory(detail ? [detail] : [], Number(range));
  const [alertOpen, setAlertOpen] = React.useState(false);

  const q = query.trim().toLowerCase();
  const codes = FOREIGN_CODES.filter(
    (c) => !q || c.toLowerCase().includes(q) || t(`currencies.${c}`).toLowerCase().includes(q),
  );
  const sorted = [
    ...codes.filter((c) => favorites.includes(c)),
    ...codes.filter((c) => !favorites.includes(c)),
  ];

  const detailQuote = detail && snapshot ? snapshot.rates[detail] : undefined;
  const detailPoints = detail ? (detailHistory?.series[detail]?.points ?? []) : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("ratesPage.title")}</h1>
          <p className="mt-1 text-sm text-ink-600">{t("ratesPage.subtitle")}</p>
        </div>
        <RateStatus snapshot={snapshot} />
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-600" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("ratesPage.search")}
          className="ps-9"
        />
      </div>

      <Card className="list-rise divide-y divide-ink-300/40 overflow-hidden">
        {sorted.length === 0 ? (
          <p className="p-8 text-center text-sm text-ink-600">{t("ratesPage.noResults")}</p>
        ) : (
          sorted.map((code, index) => {
            const quote = snapshot?.rates[code];
            const points = history?.series[code]?.points.map((p) => p.c) ?? [];
            const tone =
              quote && quote.changePct24h > 0.005
                ? "up"
                : quote && quote.changePct24h < -0.005
                  ? "down"
                  : "neutral";
            const starred = favorites.includes(code);
            return (
              <div
                key={code}
                style={{ "--i": index } as React.CSSProperties}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-canvas"
              >
                <button
                  type="button"
                  onClick={() => toggle(code)}
                  aria-label={t(starred ? "ratesPage.unfavorite" : "ratesPage.favorite", {
                    currency: t(`currencies.${code}`),
                  })}
                  aria-pressed={starred}
                  className="pressable rounded-lg p-1.5 text-ink-600 hover:bg-ink-300/20"
                >
                  <Star className={cn("size-4", starred && "fill-warn text-warn")} />
                </button>
                <button
                  type="button"
                  onClick={() => setDetail(code)}
                  className="pressable flex min-w-0 flex-1 items-center gap-3 text-start"
                >
                  <CoinIcon code={code} size={34} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {t(`currencies.${code}`)}
                    </span>
                    <span className="block text-xs text-ink-600" dir="ltr">
                      {code}
                    </span>
                  </span>
                  <span className="hidden sm:block">
                    {points.length > 1 ? (
                      <Sparkline points={points} width={88} height={28} tone={tone} />
                    ) : (
                      <Skeleton className="h-7 w-22" />
                    )}
                  </span>
                  <span className="w-28 text-end sm:w-36">
                    {quote ? (
                      <>
                        <span className="num block text-sm font-semibold">
                          {formatRate(quote.mid, locale)}
                          <span className="ms-1 text-xs font-normal text-ink-600">
                            {t("converter.toman")}
                          </span>
                        </span>
                        <ChangeChip pct={quote.changePct24h} locale={locale} className="mt-1" />
                      </>
                    ) : (
                      <Skeleton className="ms-auto h-9 w-24" />
                    )}
                  </span>
                </button>
              </div>
            );
          })
        )}
      </Card>

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

      {/* Price alerts land with auth in Phase 2 — say so plainly (§18). */}
      <Dialog open={alertOpen} onOpenChange={setAlertOpen}>
        <DialogContent className="p-6">
          <DialogTitle className="text-base font-semibold">{t("ratesPage.alertTitle")}</DialogTitle>
          <DialogDescription className="mt-2 text-sm leading-relaxed text-ink-600">
            {t("ratesPage.alertBody")}
          </DialogDescription>
          <Badge variant="info" className="mt-4 self-start">
            {t("common.phase2")}
          </Badge>
        </DialogContent>
      </Dialog>
    </div>
  );
}
