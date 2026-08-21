"use client";

import { CircleAlert } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { useNow } from "@/lib/hooks/use-now";
import { formatSecondsAgo, type AppLocale } from "@/lib/money/format";
import type { RatesSnapshot } from "@/lib/rates/types";
import { cn } from "@/lib/utils";

interface RateStatusProps {
  snapshot: RatesSnapshot | undefined;
  className?: string;
}

/**
 * "Updated Xs ago" ticker + degraded flag (§7.1: never silently show a stale
 * number). Fetch time drives the ticker; source observation time is what the
 * degraded copy references.
 */
export function RateStatus({ snapshot, className }: RateStatusProps) {
  const t = useTranslations("rates.status");
  const locale = useLocale() as AppLocale;
  const now = useNow(1000);

  if (!snapshot) {
    return <span className={cn("text-xs text-ink-600", className)}>{t("loading")}</span>;
  }

  const fetchedSec = now ? Math.max(0, (now.getTime() - Date.parse(snapshot.fetchedAt)) / 1000) : 0;

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-2", className)}>
      <span className="inline-flex items-center gap-1.5 text-xs text-ink-600">
        <span
          className={cn("size-1.5 rounded-full", snapshot.degraded ? "bg-warn" : "bg-up")}
          aria-hidden
        />
        {now ? t("updated", { ago: formatSecondsAgo(fetchedSec, locale) }) : t("live")}
      </span>
      {snapshot.degraded ? (
        <Badge variant="warn">
          <CircleAlert className="size-3.5" aria-hidden />
          {snapshot.source === "demo" ? t("demo") : t("degraded")}
        </Badge>
      ) : null}
    </span>
  );
}
