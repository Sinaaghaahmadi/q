"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { ChangeChip } from "@/components/rates/change-chip";
import { HistoryChart } from "@/components/rates/history-chart";
import { Sparkline } from "@/components/rates/sparkline";
import { Card } from "@/components/ui/card";
import { type AppLocale } from "@/lib/money/format";
import { syntheticHistory } from "@/lib/rates/providers/demo";

/** Chart specimens: 2px line, single series, ink-colored text, glyph+sign chips. */
export function ChartsDemo() {
  const t = useTranslations("design.charts");
  const locale = useLocale() as AppLocale;

  const series = React.useMemo(() => syntheticHistory("USD", 189_400, 90), []);
  const upPoints = React.useMemo(() => syntheticHistory("EUR", 221_000, 30).map((p) => p.c), []);
  const downPoints = React.useMemo(
    () => [...syntheticHistory("TRY", 3_960, 30).map((p) => p.c)].reverse(),
    [],
  );

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="p-5 lg:col-span-2">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-ink-600">{t("history")}</p>
          <ChangeChip pct={1.24} locale={locale} />
        </div>
        <HistoryChart points={series} height={200} />
      </Card>
      <Card className="space-y-5 p-5">
        <div>
          <p className="mb-2 text-sm font-medium text-ink-600">{t("sparkUp")}</p>
          <div className="flex items-center gap-3">
            <Sparkline points={upPoints} width={120} height={34} tone="up" />
            <ChangeChip pct={0.82} locale={locale} />
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-ink-600">{t("sparkDown")}</p>
          <div className="flex items-center gap-3">
            <Sparkline points={downPoints} width={120} height={34} tone="down" />
            <ChangeChip pct={-0.47} locale={locale} />
          </div>
        </div>
        <p className="text-xs leading-relaxed text-ink-600">{t("note")}</p>
      </Card>
    </div>
  );
}
