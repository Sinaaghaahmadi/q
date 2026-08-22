"use client";

import { Search } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { AuditLogEntry, Json } from "@/lib/supabase/types";

const ENTITIES = ["exchange_offices", "orders", "office_rate_config", "memberships", "settings"];

/**
 * The immutable trail (§4.3 /admin/audit, §16.8). Rows can never be edited or
 * removed — a trigger refuses both — so this screen only ever reads. Each row
 * expands to the before/after diff that §16.8 asks for, rendered as the two
 * jsonb payloads rather than a reconstruction, so what is shown is what was
 * recorded.
 */
export function AuditTrail({
  entries,
  query,
  entity,
}: {
  entries: AuditLogEntry[];
  query: string;
  entity: string;
}) {
  const t = useTranslations("admin.audit");
  const format = useFormatter();
  const router = useRouter();

  const [q, setQ] = React.useState(query);
  const [expanded, setExpanded] = React.useState<string | null>(null);

  function search(nextEntity = entity) {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (nextEntity) params.set("entity", nextEntity);
    router.push(`/admin/audit${params.size > 0 ? `?${params}` : ""}`);
  }

  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
      >
        <Input
          className="max-w-xs"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
        />
        <Button type="submit" variant="secondary">
          <Search className="size-4" aria-hidden />
          {t("search")}
        </Button>
        <select
          value={entity}
          onChange={(e) => search(e.target.value)}
          aria-label={t("entity")}
          className="h-11 rounded-xl border border-ink-300 bg-surface px-3 text-sm focus:border-brand-600 focus:ring-2 focus:ring-brand-600/25 focus:outline-none"
        >
          <option value="">{t("allEntities")}</option>
          {ENTITIES.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
      </form>

      {entries.length === 0 ? (
        <Card className="p-10 text-center text-sm text-ink-600">{t("empty")}</Card>
      ) : (
        <ol className="space-y-2">
          {entries.map((entry) => (
            <li key={entry.id}>
              <Card className="p-4">
                <button
                  type="button"
                  className="flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 text-start"
                  onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                  aria-expanded={expanded === entry.id}
                >
                  <span className="font-mono text-sm" dir="ltr">
                    {entry.action}
                  </span>
                  <Badge variant="outline">{entry.entity_type}</Badge>
                  {entry.actor_role ? <Badge variant="neutral">{entry.actor_role}</Badge> : null}
                  {entry.reason ? (
                    <span className="min-w-0 flex-1 truncate text-sm text-ink-600">
                      {entry.reason}
                    </span>
                  ) : (
                    <span className="flex-1" />
                  )}
                  <time
                    dateTime={entry.created_at}
                    className="shrink-0 text-xs text-ink-600 tabular-nums"
                  >
                    {format.dateTime(new Date(entry.created_at), {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </time>
                </button>

                {expanded === entry.id ? (
                  <div className="mt-3 grid gap-3 border-t border-ink-300/40 pt-3 sm:grid-cols-2">
                    <Diff label={t("before")} payload={entry.before} />
                    <Diff label={t("after")} payload={entry.after} />
                  </div>
                ) : null}
              </Card>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Diff({ label, payload }: { label: string; payload: Json | null }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-xs font-medium text-ink-600">{label}</p>
      <pre
        dir="ltr"
        className="max-h-56 overflow-auto rounded-xl bg-canvas p-3 font-mono text-[0.6875rem] leading-relaxed"
      >
        {payload === null ? "—" : JSON.stringify(payload, null, 2)}
      </pre>
    </div>
  );
}
