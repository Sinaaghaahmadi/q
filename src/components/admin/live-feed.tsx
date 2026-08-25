"use client";

import { ShieldAlert } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import * as React from "react";
import { describeAudit } from "@/lib/admin/audit-language";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AuditLogEntry } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

/**
 * What has been happening, in words.
 *
 * Reads the audit log rather than a bespoke event stream, so anything that
 * changes the platform appears here by construction instead of by somebody
 * remembering to publish it. What changed is the reading: the rows used to be
 * printed as their stored identifiers, which is correct for a log and useless
 * on a screen.
 *
 * An override — a forced transition, an impersonation, an office switched off —
 * is marked. Those are the rows an administrator scans for, and in a list where
 * every line looks the same they are found by reading all of them.
 */
export function LiveFeed({ entries }: { entries: AuditLogEntry[] }) {
  const t = useTranslations("admin");
  const tAudit = useTranslations("admin.audit");
  const format = useFormatter();

  function phrase(action: string): { text: string; notable: boolean } {
    const parsed = describeAudit(action);

    if (parsed.named && tAudit.has(`named.${parsed.named}`)) {
      return { text: tAudit(`named.${parsed.named}`), notable: parsed.notable };
    }
    if (parsed.subject && parsed.verb) {
      const hasSubject = tAudit.has(`subject.${parsed.subject}`);
      const hasVerb = tAudit.has(`verb.${parsed.verb}`);
      if (hasSubject && hasVerb) {
        return {
          text: tAudit("pattern", {
            subject: tAudit(`subject.${parsed.subject}`),
            verb: tAudit(`verb.${parsed.verb}`),
          }),
          notable: parsed.notable,
        };
      }
      // Half-known is still better than raw: a table nobody has named yet at
      // least says what happened to it.
      if (hasVerb) {
        return {
          text: tAudit("pattern", { subject: parsed.subject, verb: tAudit(`verb.${parsed.verb}`) }),
          notable: parsed.notable,
        };
      }
    }
    return { text: parsed.raw, notable: parsed.notable };
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("feed")}</CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-ink-600">{t("noActivity")}</p>
        ) : (
          <ol className="-my-1.5 divide-y divide-ink-300/30">
            {entries.map((entry) => {
              const { text, notable } = phrase(entry.action);
              return (
                <li key={entry.id} className="flex items-start gap-2.5 py-2 text-sm">
                  <span
                    className={cn(
                      "mt-1 flex size-4 shrink-0 items-center justify-center",
                      notable ? "text-warn" : "text-ink-300",
                    )}
                    aria-hidden
                  >
                    {notable ? (
                      <ShieldAlert className="size-4" />
                    ) : (
                      <span className="size-1.5 rounded-full bg-current" />
                    )}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className={cn("block leading-snug", notable && "font-medium")}>
                      {text}
                    </span>
                    {entry.reason ? (
                      <span className="mt-0.5 block truncate text-xs text-ink-600">
                        {entry.reason}
                      </span>
                    ) : null}
                  </span>

                  <time
                    dateTime={entry.created_at}
                    className="num shrink-0 pt-0.5 text-xs text-ink-600"
                  >
                    {format.dateTime(new Date(entry.created_at), {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
