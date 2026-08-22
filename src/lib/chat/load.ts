import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Message } from "@/lib/supabase/types";

export type LoadedConversation = {
  id: string;
  messages: Message[];
  /** Display names by sender id, so the bubbles do not each fetch a profile. */
  senderNames: Record<string, string>;
};

/**
 * A conversation's recent history plus the names to render on it. RLS decides
 * what comes back — an internal note simply is not in the result for a customer
 * — so there is nothing to filter here, and no way for this to leak by omission.
 */
export async function loadConversation(
  conversationId: string,
  locale: string,
  limit = 200,
): Promise<LoadedConversation> {
  const supabase = await createClient();

  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(limit);

  const rows = (messages ?? []) as Message[];
  const senderIds = [
    ...new Set(rows.map((m) => m.sender_id).filter((id): id is string => id !== null)),
  ];

  const senderNames: Record<string, string> = {};
  if (senderIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name_fa, full_name_latin")
      .in("id", senderIds);

    for (const profile of profiles ?? []) {
      const name =
        locale === "fa"
          ? (profile.full_name_fa ?? profile.full_name_latin)
          : (profile.full_name_latin ?? profile.full_name_fa);
      if (name) senderNames[profile.id] = name;
    }
  }

  return { id: conversationId, messages: rows, senderNames };
}
