"use client";

import { useFormatter, useTranslations } from "next-intl";
import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AuditLogEntry } from "@/lib/supabase/types";

/**
 * The live-ops wall in miniature (§17.18) — the screen ops keeps open. It reads
 * the audit log rather than a bespoke event feed, so anything that changes the
 * platform shows up here by construction instead of by remembering to publish.
 */
export function LiveFeed({ entries }: { entries: AuditLogEntry[] }) {
  const t = useTranslations("admin");
  const format = useFormatter();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("feed")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {entries.length === 0 ? (
          <p className="text-sm text-ink-600">{t("noActivity")}</p>
        ) : (
          <ol className="space-y-3">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-start gap-3 text-sm">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-600" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{entry.action}</span>
                  {entry.reason ? (
                    <span className="block truncate text-ink-600">{entry.reason}</span>
                  ) : null}
                </span>
                <time
                  dateTime={entry.created_at}
                  className="shrink-0 text-xs text-ink-600 tabular-nums"
                >
                  {format.dateTime(new Date(entry.created_at), {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
