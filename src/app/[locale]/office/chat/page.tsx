import { Building2 } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import * as React from "react";
import { EmptyState } from "@/components/layout/empty-state";
import { OfficeChatInbox, type ChatThread } from "@/components/office/office-chat-inbox";
import { OfficeShell } from "@/components/office/office-shell";
import { redirect } from "@/i18n/navigation";
import { officeScopes } from "@/lib/auth/can";
import { loadConversation } from "@/lib/chat/load";
import { createClient, getSessionProfile, isSupabaseConfigured } from "@/lib/supabase/server";
import type { Conversation, ExchangeOffice, Message } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "officePanel.chat" });
  return { title: t("metaTitle") };
}

export default async function OfficeChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ thread?: string }>;
}) {
  const { locale } = await params;
  const { thread } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("officePanel.chat");
  const shell = await getTranslations("officePanel");

  if (!isSupabaseConfigured()) {
    return (
      <EmptyState
        icon={Building2}
        title={shell("unavailableTitle")}
        description={shell("unavailableBody")}
        ctaLabel={shell("backHome")}
      />
    );
  }

  const session = await getSessionProfile();
  if (!session?.user) {
    redirect({ href: "/signin?next=/office/chat", locale });
  }

  const officeId = officeScopes(session?.memberships ?? [])[0];
  if (!officeId) {
    return (
      <EmptyState
        icon={Building2}
        title={shell("notAMemberTitle")}
        description={shell("notAMemberBody")}
        ctaLabel={shell("backHome")}
      />
    );
  }

  const supabase = await createClient();
  const [{ data: office }, { data: orders }] = await Promise.all([
    supabase.from("exchange_offices").select("*").eq("id", officeId).maybeSingle(),
    supabase
      .from("orders")
      .select("id, public_ref")
      .eq("office_id", officeId)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const refs = new Map((orders ?? []).map((order) => [order.id, order.public_ref]));

  // A conversation carries no office column: an order thread belongs to this
  // office because its subject does. The participant policy then decides again
  // on the way out, so a thread the office was never joined to never arrives.
  const [{ data: orderThreads }, { data: supportThreads }] = await Promise.all([
    refs.size > 0
      ? supabase
          .from("conversations")
          .select("*")
          .eq("kind", "order")
          .in("subject_id", [...refs.keys()])
          .order("last_message_at", { ascending: false, nullsFirst: false })
      : Promise.resolve({ data: [] as Conversation[] }),
    supabase
      .from("conversations")
      .select("*")
      .eq("kind", "support")
      .eq("segment", "office")
      .order("last_message_at", { ascending: false, nullsFirst: false }),
  ]);

  const threads: ChatThread[] = [
    ...((orderThreads ?? []) as Conversation[]).map((conversation) => ({
      id: conversation.id,
      kind: "order" as const,
      status: conversation.status,
      lastMessageAt: conversation.last_message_at,
      orderRef: conversation.subject_id ? (refs.get(conversation.subject_id) ?? null) : null,
    })),
    ...((supportThreads ?? []) as Conversation[]).map((conversation) => ({
      id: conversation.id,
      kind: "support" as const,
      status: conversation.status,
      lastMessageAt: conversation.last_message_at,
      orderRef: null,
    })),
  ];

  const openThread = thread && threads.some((row) => row.id === thread) ? thread : null;

  let messages: Message[] = [];
  let senderNames: Record<string, string> = {};
  if (openThread) {
    const loaded = await loadConversation(openThread, locale);
    messages = loaded.messages;
    senderNames = loaded.senderNames;
  }

  return (
    <OfficeShell
      office={(office ?? null) as ExchangeOffice | null}
      locale={locale}
      title={t("title")}
      description={t("subtitle")}
    >
      <OfficeChatInbox
        threads={threads}
        openThread={openThread}
        messages={messages}
        senderNames={senderNames}
        viewerId={session!.user.id}
      />
    </OfficeShell>
  );
}
