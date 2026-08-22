import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { formatDate, type AppLocale } from "@/lib/money/format";
import { stateTone } from "@/lib/orders/flow";
import type { OrderEvent } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

/**
 * The append-only truth of an order (§8.1). `order_events` cannot be updated or
 * deleted, so this is the record — not a summary of one. Oldest first, because
 * the story only reads forward.
 */
export function OrderTimeline({ events }: { events: OrderEvent[] }) {
  const t = useTranslations("orders");
  const locale = useLocale() as AppLocale;

  if (events.length === 0) {
    return <p className="text-sm text-ink-600">{t("noEvents")}</p>;
  }

  return (
    <ol className="relative space-y-0">
      {events.map((event, i) => {
        const last = i === events.length - 1;
        return (
          <li key={event.id} className="flex gap-3">
            {/* rail: the dot, and a connector that stops at the last event */}
            <span className="flex flex-col items-center" aria-hidden>
              <span
                className={cn(
                  "mt-1.5 size-2.5 shrink-0 rounded-full",
                  last ? "bg-brand-600 ring-4 ring-brand-50" : "bg-ink-300",
                )}
              />
              {!last ? <span className="w-0.5 flex-1 bg-ink-300/60" /> : null}
            </span>

            <div className={cn("min-w-0 flex-1", last ? "pb-1" : "pb-6")}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={stateTone(event.to_state)}>{t(`state.${event.to_state}`)}</Badge>
                {event.actor_role ? (
                  <span className="text-xs text-ink-600">
                    {t("by", { role: t(`actorRole.${event.actor_role}`) })}
                  </span>
                ) : null}
              </div>
              <p className="num mt-1 text-xs text-ink-600">
                {formatDate(event.created_at, locale, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
              {event.reason ? (
                <p className="mt-1.5 rounded-lg bg-canvas px-3 py-2 text-sm leading-relaxed text-ink-600">
                  {event.reason}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
