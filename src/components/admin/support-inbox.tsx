"use client";

import { Check, Clock, UserCheck } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Conversation as ConversationView } from "@/components/chat/conversation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import type { Conversation, Message, SupportSegment } from "@/lib/supabase/types";

/**
 * §10.3 / §16.6: one engine, three queues. The segment is a column the database
 * derived from who opened the thread, so switching tabs here is a filter and
 * never a reclassification — an exchange office cannot end up in the customer
 * queue by choosing it.
 */
export function SupportInbox({
  segments,
  activeSegment,
  conversations,
  openThread,
  messages,
  senderNames,
  viewerId,
}: {
  segments: { key: SupportSegment; count: number }[];
  activeSegment: SupportSegment;
  conversations: Conversation[];
  openThread: string | null;
  messages: Message[];
  senderNames: Record<string, string>;
  viewerId: string;
}) {
  const t = useTranslations("admin.support");
  const format = useFormatter();
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  const thread = conversations.find((c) => c.id === openThread) ?? null;

  async function setState(status: string | null, assign: boolean) {
    if (!thread) return;
    setBusy(true);
    const { createClient } = await import("@/lib/supabase/client");
    await createClient().rpc("support_set_state", {
      p_conversation: thread.id,
      p_status: status,
      p_assign: assign,
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {segments.map((s) => (
          <Link
            key={s.key}
            href={`/admin/support?segment=${s.key}`}
            aria-current={s.key === activeSegment ? "page" : undefined}
            className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              s.key === activeSegment
                ? "bg-brand-600 text-white"
                : "bg-ink-300/25 text-ink-600 hover:text-ink-900"
            }`}
          >
            {t(`segment.${s.key}`)}
            <span className="tabular-nums opacity-70">{s.count}</span>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        <Card className="divide-y divide-ink-300/30">
          {conversations.length === 0 ? (
            <p className="p-8 text-center text-sm text-ink-600">{t("emptyQueue")}</p>
          ) : (
            conversations.map((c) => {
              const overdue =
                c.sla_due_at !== null &&
                c.status !== "resolved" &&
                new Date(c.sla_due_at).getTime() < Date.now();
              return (
                <Link
                  key={c.id}
                  href={`/admin/support?segment=${activeSegment}&thread=${c.id}`}
                  className={`block px-4 py-3 transition-colors hover:bg-canvas ${
                    c.id === openThread ? "bg-canvas" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs" dir="ltr">
                      {c.id.slice(0, 8)}
                    </span>
                    <Badge variant={c.status === "resolved" ? "up" : overdue ? "down" : "neutral"}>
                      {t(`status.${c.status}`)}
                    </Badge>
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-600">
                    <Clock className="size-3" aria-hidden />
                    {c.last_message_at
                      ? format.relativeTime(new Date(c.last_message_at))
                      : t("noMessages")}
                    {c.assigned_to ? (
                      <>
                        {" · "}
                        <UserCheck className="size-3" aria-hidden />
                        {c.assigned_to === viewerId ? t("assignedToYou") : t("assigned")}
                      </>
                    ) : null}
                  </p>
                </Link>
              );
            })
          )}
        </Card>

        <Card className="space-y-4 p-5">
          {thread ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy || thread.assigned_to === viewerId}
                  onClick={() => setState(null, true)}
                >
                  <UserCheck className="size-4" aria-hidden />
                  {thread.assigned_to === viewerId ? t("assignedToYou") : t("assignToMe")}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy || thread.status === "resolved"}
                  onClick={() => setState("resolved", false)}
                >
                  <Check className="size-4" aria-hidden />
                  {t("resolve")}
                </Button>
              </div>

              <ConversationView
                conversationId={thread.id}
                viewerId={viewerId}
                canWriteNotes
                initialMessages={messages}
                senderNames={senderNames}
              />
            </>
          ) : (
            <p className="py-16 text-center text-sm text-ink-600">{t("pickThread")}</p>
          )}
        </Card>
      </div>
    </div>
  );
}
