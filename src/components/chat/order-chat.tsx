import { MessageSquare } from "lucide-react";
import { getTranslations } from "next-intl/server";
import * as React from "react";
import { Conversation } from "@/components/chat/conversation";
import { Card } from "@/components/ui/card";
import { loadConversation } from "@/lib/chat/load";
import { createClient } from "@/lib/supabase/server";
import type { OrderActorRole, OrderState } from "@/lib/supabase/types";

/**
 * The order's conversation, opened lazily on first render (§10.1: available
 * from `office_review` onward, before acceptance on purpose). Before an office
 * is looking at the order there is nobody to talk to, and saying that plainly
 * beats rendering a box that refuses every message.
 */
export async function OrderChat({
  orderId,
  state,
  role,
  viewerId,
  locale,
}: {
  orderId: string;
  state: OrderState;
  role: OrderActorRole | null;
  viewerId: string;
  locale: string;
}) {
  const t = await getTranslations("chat");

  if (state === "draft" || state === "submitted" || state === "matching") {
    return (
      <Card className="space-y-2 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <MessageSquare className="size-4 text-brand-600" aria-hidden />
          {t("orderTitle")}
        </h2>
        <p className="text-sm text-ink-600">{t("notYet")}</p>
      </Card>
    );
  }

  const supabase = await createClient();
  const { data: conversationId, error } = await supabase.rpc("conversation_for_order", {
    p_order: orderId,
  });

  if (error || !conversationId) {
    return (
      <Card className="space-y-2 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <MessageSquare className="size-4 text-brand-600" aria-hidden />
          {t("orderTitle")}
        </h2>
        <p className="text-sm text-ink-600">{t("unavailable")}</p>
      </Card>
    );
  }

  const { messages, senderNames } = await loadConversation(conversationId, locale);

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <MessageSquare className="size-4 text-brand-600" aria-hidden />
          {t("orderTitle")}
        </h2>
        <p className="mt-1 text-sm text-ink-600">{t("orderBody")}</p>
      </div>
      <Conversation
        conversationId={conversationId}
        viewerId={viewerId}
        canWriteNotes={role === "office" || role === "platform"}
        initialMessages={messages}
        senderNames={senderNames}
      />
    </Card>
  );
}
