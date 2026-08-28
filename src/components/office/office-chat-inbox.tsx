"use client";

import { Clock, LifeBuoy } from "lucide-react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import * as React from "react";
import { Conversation as ConversationView } from "@/components/chat/conversation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import type { Conversation, Message } from "@/lib/supabase/types";

export type ChatThread = {
  id: string;
  kind: "order" | "support";
  status: Conversation["status"];
  lastMessageAt: string | null;
  /** The order this thread hangs off, when it is an order thread. */
  orderRef: string | null;
};

/**
 * Every conversation this office is party to, in one place (§4.2).
 *
 * The two kinds sit in one list under two headings rather than behind a filter:
 * an office has a handful of live threads, not a queue, and a customer waiting
 * on an answer must not be one click further away than a support ticket. What
 * is listed is decided by the participant policy, not by this component — a
 * thread the office was never joined to simply never arrives.
 */
export function OfficeChatInbox({
  threads,
  openThread,
  messages,
  senderNames,
  viewerId,
}: {
  threads: ChatThread[];
  openThread: string | null;
  messages: Message[];
  senderNames: Record<string, string>;
  viewerId: string;
}) {
  const t = useTranslations("officePanel.chat");

  const orders = threads.filter((thread) => thread.kind === "order");
  const support = threads.filter((thread) => thread.kind === "support");
  const open = threads.find((thread) => thread.id === openThread) ?? null;

  // `message_send` derives the internal-note privilege from the office behind
  // the order, so a support thread has no office side to grant it. Offering the
  // checkbox there would only earn a refusal that throws away what was typed.
  const canWriteNotes = open?.kind === "order";

  return (
    <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
      <Card className="divide-y divide-ink-300/30">
        {threads.length === 0 ? (
          <p className="p-8 text-center text-sm text-ink-600">{t("empty")}</p>
        ) : (
          <>
            {orders.length > 0 ? (
              <p className="px-4 py-2 text-xs font-semibold text-ink-600">{t("sectionOrders")}</p>
            ) : null}
            {orders.map((thread) => (
              <Row key={thread.id} thread={thread} openThread={openThread} />
            ))}
            {support.length > 0 ? (
              <p className="px-4 py-2 text-xs font-semibold text-ink-600">{t("sectionSupport")}</p>
            ) : null}
            {support.map((thread) => (
              <Row key={thread.id} thread={thread} openThread={openThread} />
            ))}
          </>
        )}
      </Card>

      <Card className="space-y-3 p-5">
        {openThread ? (
          <>
            <ConversationView
              conversationId={openThread}
              viewerId={viewerId}
              canWriteNotes={canWriteNotes}
              initialMessages={messages}
              senderNames={senderNames}
            />
            {canWriteNotes ? <p className="text-xs text-ink-600">{t("notesHint")}</p> : null}
          </>
        ) : (
          <p className="py-16 text-center text-sm text-ink-600">{t("pickThread")}</p>
        )}
      </Card>
    </div>
  );
}

/**
 * Declared here rather than inside the inbox: a component defined in a render
 * body is a new type on every render, so React would tear down and rebuild
 * every row each time a thread is opened.
 */
function Row({ thread, openThread }: { thread: ChatThread; openThread: string | null }) {
  const t = useTranslations("officePanel.chat");
  const format = useFormatter();
  /* An explicit `now`, so "seven minutes ago" is measured against a moment
     both sides of the render agree on. Left to itself next-intl reaches
     for the environment's clock and says so on the console, once per
     row. It ticks every minute, which is the granularity shown. */
  const now = useNow({ updateInterval: 60_000 });

  return (
    <Link
      href={`/office/chat?thread=${thread.id}`}
      aria-current={thread.id === openThread ? "page" : undefined}
      className={`block px-4 py-3 transition-colors hover:bg-canvas ${
        thread.id === openThread ? "bg-canvas" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        {thread.kind === "order" ? (
          <span className="num font-mono text-xs" dir="ltr">
            {thread.orderRef ?? t("unknownOrder")}
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs font-medium">
            <LifeBuoy className="size-3.5" aria-hidden />
            {t("supportThread")}
          </span>
        )}
        <Badge variant={thread.status === "resolved" ? "up" : "neutral"}>
          {t(`status.${thread.status}`)}
        </Badge>
      </div>
      <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-600">
        <Clock className="size-3" aria-hidden />
        {thread.lastMessageAt
          ? format.relativeTime(new Date(thread.lastMessageAt), now)
          : t("noMessages")}
      </p>
    </Link>
  );
}
