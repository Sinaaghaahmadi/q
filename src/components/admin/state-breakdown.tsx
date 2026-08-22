import { useTranslations } from "next-intl";
import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { stateTone } from "@/lib/orders/flow";
import type { OrderState } from "@/lib/supabase/types";

const TONE_BAR: Record<ReturnType<typeof stateTone>, string> = {
  neutral: "bg-ink-600/50",
  info: "bg-brand-600",
  up: "bg-up",
  warn: "bg-warn",
  down: "bg-down",
};

/**
 * Orders by state (§4.3). A bar per state rather than a donut: the question an
 * ops lead actually asks is "where is the queue piling up", and a sorted bar
 * answers it at a glance in both reading directions.
 */
export function StateBreakdown({
  counts,
  total,
}: {
  counts: [OrderState, number][];
  total: number;
}) {
  const t = useTranslations("orders.state");
  const heading = useTranslations("admin");
  const sorted = [...counts].sort((a, b) => b[1] - a[1]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{heading("byState")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {sorted.length === 0 ? (
          <p className="text-sm text-ink-600">{heading("noOrders")}</p>
        ) : (
          sorted.map(([state, count]) => (
            <div key={state} className="flex items-center gap-3">
              <span className="w-40 shrink-0 truncate text-sm">{t(state)}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-ink-300/40">
                <span
                  className={`block h-full rounded-full ${TONE_BAR[stateTone(state)]}`}
                  style={{ width: `${total > 0 ? Math.max(4, (count / total) * 100) : 0}%` }}
                />
              </span>
              <span className="w-10 shrink-0 text-end text-sm tabular-nums">{count}</span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
