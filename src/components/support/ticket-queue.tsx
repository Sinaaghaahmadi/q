"use client";

import { ArrowUpCircle, CircleAlert, Clock3 } from "lucide-react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import * as React from "react";
import { TicketScene } from "@/components/brand/scenes/support";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import type { SupportTicket, TicketState } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

export type QueueRow = SupportTicket & {
  /** Display name of whoever filed it, resolved server-side. */
  openerName: string | null;
  /** Name of the office that owes the answer, when one does. */
  officeName: string | null;
};

/** Tone per state — colour is never the only signal, every badge carries text. */
const TONE: Record<TicketState, "up" | "down" | "warn" | "info" | "neutral"> = {
  open: "info",
  in_progress: "info",
  waiting_user: "warn",
  escalated: "down",
  resolved: "up",
  closed: "neutral",
};

/**
 * The ticket queue, shared by the office panel and the admin console.
 *
 * One component for both because the difference between them is authority, not
 * layout: an office sees its own tickets and answers them; the platform sees
 * everything and can act on any of them, including ones an office is sitting
 * on. Forking this into two near-identical tables is how the two views drift
 * until one of them quietly stops showing escalations.
 *
 * `scope` decides which extra controls appear. The database decides what is
 * actually permitted — `ticket_set_state` and `ticket_escalate` check the
 * caller themselves, so a hidden button is a courtesy, never a boundary.
 */
export function TicketQueue({
  rows,
  scope,
  responseHours,
}: {
  rows: QueueRow[];
  scope: "office" | "platform";
  responseHours: number;
}) {
  const t = useTranslations("tickets");
  const format = useFormatter();
  /* An explicit `now`, so "seven minutes ago" is measured against a moment
     both sides of the render agree on. Left to itself next-intl reaches
     for the environment's clock and says so on the console, once per
     row. It ticks every minute, which is the granularity shown. */
  const now = useNow({ updateInterval: 60_000 });
  const router = useRouter();
  const toast = useToast();

  const [filter, setFilter] = React.useState<"live" | "escalated" | "all">("live");
  const [busy, setBusy] = React.useState<string | null>(null);

  const visible = rows.filter((row) => {
    if (filter === "all") return true;
    if (filter === "escalated") return row.state === "escalated";
    return row.state !== "resolved" && row.state !== "closed";
  });

  /** Hours the responsible party has been silent, or null once answered. */
  function silentFor(row: QueueRow): number | null {
    if (row.first_response_at) return null;
    return (Date.now() - new Date(row.created_at).getTime()) / 3_600_000;
  }

  async function move(id: string, state: TicketState) {
    setBusy(id);
    const { error } = await createClient().rpc("ticket_set_state", {
      p_ticket: id,
      p_state: state,
    });
    setBusy(null);
    if (error) {
      toast(t("errors.failed"), "bad");
      return;
    }
    toast(t(`moved.${state}`));
    router.refresh();
  }

  async function escalate(id: string) {
    setBusy(id);
    const { error } = await createClient().rpc("ticket_escalate", {
      p_ticket: id,
      p_reason: null,
    });
    setBusy(null);
    if (error) {
      toast(
        /already with the platform/i.test(error.message)
          ? t("errors.alreadyEscalated")
          : t("errors.failed"),
        "bad",
      );
      return;
    }
    toast(t("moved.escalated"));
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Segmented<"live" | "escalated" | "all">
        label={t("filterLabel")}
        value={filter}
        onChange={setFilter}
        options={[
          { value: "live", label: t("filters.live") },
          { value: "escalated", label: t("filters.escalated") },
          { value: "all", label: t("filters.all") },
        ]}
      />

      {visible.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-8 text-center">
          <TicketScene size={120} label={t("empty")} />
          <p className="text-sm text-ink-600">{t("empty")}</p>
        </Card>
      ) : (
        <div className="list-rise space-y-3">
          {visible.map((row, index) => {
            const silent = silentFor(row);
            const overdue = silent !== null && silent > responseHours;
            return (
              <Card
                key={row.id}
                style={{ "--i": index } as React.CSSProperties}
                className={cn("p-4", row.state === "escalated" && "border-down/50")}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="num font-mono text-xs font-semibold" dir="ltr">
                        {row.public_ref}
                      </span>
                      <Badge variant={TONE[row.state]}>{t(`state.${row.state}`)}</Badge>
                      {row.priority === "urgent" || row.priority === "high" ? (
                        <Badge variant="warn">{t(`priority.${row.priority}`)}</Badge>
                      ) : null}
                      <span className="text-xs text-ink-600">{t(`category.${row.category}`)}</span>
                    </div>
                    <p className="mt-1.5 truncate font-medium">{row.subject}</p>
                    <p className="mt-0.5 text-xs text-ink-600">
                      {t("filedBy", { name: row.openerName ?? t("someone") })} ·{" "}
                      {format.relativeTime(new Date(row.created_at), now)}
                      {scope === "platform" && row.officeName ? ` · ${row.officeName}` : ""}
                    </p>

                    {overdue ? (
                      <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-down-ink">
                        <Clock3 className="size-3.5" aria-hidden />
                        {t("overdue", { hours: Math.floor(silent ?? 0) })}
                      </p>
                    ) : silent !== null ? (
                      <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-ink-600">
                        <Clock3 className="size-3.5" aria-hidden />
                        {t("awaitingFirstReply")}
                      </p>
                    ) : null}

                    {row.escalation_reason ? (
                      <p className="mt-2 inline-flex items-start gap-1.5 text-xs text-down-ink">
                        <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                        {row.escalation_reason}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    {row.state !== "resolved" && row.state !== "closed" ? (
                      <>
                        {row.state !== "in_progress" ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={busy === row.id}
                            onClick={() => move(row.id, "in_progress")}
                          >
                            {t("actions.take")}
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          disabled={busy === row.id}
                          onClick={() => move(row.id, "resolved")}
                        >
                          {t("actions.resolve")}
                        </Button>
                      </>
                    ) : scope === "platform" ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy === row.id}
                        onClick={() => move(row.id, "open")}
                      >
                        {t("actions.reopen")}
                      </Button>
                    ) : null}

                    {/* The office hands over what it cannot answer; the platform
                        pulls in what an office has left sitting. */}
                    {row.state !== "escalated" &&
                    row.state !== "resolved" &&
                    row.state !== "closed" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy === row.id}
                        onClick={() => escalate(row.id)}
                      >
                        <ArrowUpCircle className="size-4" aria-hidden />
                        {scope === "office" ? t("actions.handOver") : t("actions.pullUp")}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
