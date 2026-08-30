"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CircleAlert, Lock, Send, ShieldAlert } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import * as React from "react";
import { EASE_IN } from "@/components/brand/scene";
import { ChatScene } from "@/components/brand/scenes/support";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { Json, Message } from "@/lib/supabase/types";

/**
 * One conversation (§10), used by the order chat, the office workspace and the
 * support inbox alike — the engine is the same, so the surface is too.
 *
 * Realtime is a live Postgres subscription on `messages`, which Supabase filters
 * through the same RLS policy as any read: a client watching a conversation it
 * cannot see is simply never sent a row. That is why there is no membership
 * check in this component — there is nowhere for it to be wrong.
 */
export function Conversation({
  conversationId,
  viewerId,
  canWriteNotes = false,
  initialMessages,
  senderNames,
}: {
  conversationId: string;
  viewerId: string;
  canWriteNotes?: boolean;
  initialMessages: Message[];
  senderNames: Record<string, string>;
}) {
  const t = useTranslations("chat");
  const format = useFormatter();
  const reduce = useReducedMotion();

  const [messages, setMessages] = React.useState(initialMessages);
  const [body, setBody] = React.useState("");
  const [internal, setInternal] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as Message;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
        },
      )
      .subscribe();

    void supabase.rpc("conversation_mark_read", { p_conversation: conversationId });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId]);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [messages.length, reduce]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const text = body.trim();
    if (text.length === 0 || sending) return;

    setSending(true);
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("message_send", {
      p_conversation: conversationId,
      p_body: text,
      p_internal: internal,
    });
    setSending(false);

    if (rpcError) {
      setError(
        /too long/i.test(rpcError.message)
          ? t("errors.tooLong")
          : /not a participant/i.test(rpcError.message)
            ? t("errors.notParticipant")
            : t("errors.failed"),
      );
      return;
    }
    setBody("");
    // The realtime INSERT delivers the row; nothing optimistic is needed, and
    // adding it here would double it up for the sender.
  }

  return (
    <div className="flex flex-col gap-3">
      <ol className="max-h-[26rem] space-y-2 overflow-y-auto pe-1" aria-live="polite">
        <AnimatePresence initial={false}>
          {messages.map((message) => {
            const mine = message.sender_id === viewerId;
            const flags = flagList(message.flags);
            return (
              <motion.li
                key={message.id}
                layout={!reduce}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={reduce ? { duration: 0 } : { duration: 0.2, ease: EASE_IN }}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                    message.is_internal_note
                      ? "border border-warn/40 bg-warn/10"
                      : mine
                        ? "bg-brand-solid text-white"
                        : "bg-ink-300/25"
                  }`}
                >
                  {!mine || message.is_internal_note ? (
                    <p className="mb-0.5 text-xs font-medium opacity-70">
                      {message.sender_id
                        ? (senderNames[message.sender_id] ?? t("someone"))
                        : t("system")}
                    </p>
                  ) : null}

                  {message.is_internal_note ? (
                    <p className="mb-1 flex items-center gap-1 text-xs font-medium text-warn">
                      <Lock className="size-3" aria-hidden />
                      {t("internalNote")}
                    </p>
                  ) : null}

                  <p className="break-words whitespace-pre-wrap">{message.body}</p>

                  <div className="mt-1 flex items-center gap-2">
                    <time
                      dateTime={message.created_at}
                      className={`text-[0.6875rem] tabular-nums ${mine && !message.is_internal_note ? "text-white/70" : "text-ink-600"}`}
                    >
                      {format.dateTime(new Date(message.created_at), {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                    {flags.map((flag) => (
                      <Badge key={flag} variant="warn" className="gap-1">
                        <ShieldAlert className="size-3" aria-hidden />
                        {t(`flag.${flag}`)}
                      </Badge>
                    ))}
                  </div>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <ChatScene size={112} label={t("empty")} />
            <p className="text-sm text-ink-600">{t("empty")}</p>
          </div>
        ) : null}
        <div ref={endRef} />
      </ol>

      <form onSubmit={send} className="space-y-2">
        <label htmlFor={`chat-${conversationId}`} className="sr-only">
          {t("placeholder")}
        </label>
        <textarea
          id={`chat-${conversationId}`}
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void send(e);
          }}
          placeholder={t("placeholder")}
          className="w-full rounded-xl border border-ink-300 bg-surface p-3 text-sm focus:border-brand-600 focus:ring-2 focus:ring-brand-600/25 focus:outline-none"
        />

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={sending || body.trim().length === 0}>
            <Send className="size-4" aria-hidden />
            {sending ? t("sending") : t("send")}
          </Button>

          {canWriteNotes ? (
            <label className="flex items-center gap-2 text-sm text-ink-600">
              <input
                type="checkbox"
                checked={internal}
                onChange={(e) => setInternal(e.target.checked)}
                className="size-4 rounded border-ink-300 text-brand-600 focus:ring-2 focus:ring-brand-600/25"
              />
              {t("asInternalNote")}
            </label>
          ) : null}

          <p className="text-xs text-ink-600">{t("offPlatformWarning")}</p>
        </div>

        {error ? (
          <p className="flex items-start gap-1.5 text-sm text-down">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error}
          </p>
        ) : null}
      </form>
    </div>
  );
}

/** The soft signals `message_flags` raised, as stable keys for the label lookup. */
function flagList(flags: Json): string[] {
  if (!flags || typeof flags !== "object" || Array.isArray(flags)) return [];
  return Object.entries(flags)
    .filter(([, value]) => value === true)
    .map(([key]) => key)
    .filter((key) => key === "off_platform" || key === "account_number" || key === "contact");
}
