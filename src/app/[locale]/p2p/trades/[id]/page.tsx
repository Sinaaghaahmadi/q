import { Handshake } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import * as React from "react";
import { Conversation } from "@/components/chat/conversation";
import { EmptyState } from "@/components/layout/empty-state";
import { TradeWorkspace } from "@/components/p2p/trade-workspace";
import { Card } from "@/components/ui/card";
import { redirect } from "@/i18n/navigation";
import { loadConversation } from "@/lib/chat/load";
import { createClient, getSessionProfile, isSupabaseConfigured } from "@/lib/supabase/server";
import type { ExchangeOffice, Order, P2pTrade } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "p2p" });
  return { title: t("trade.metaTitle") };
}

export default async function TradePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("p2p");

  if (!isSupabaseConfigured()) {
    return (
      <EmptyState
        icon={Handshake}
        title={t("unavailableTitle")}
        description={t("unavailableBody")}
        ctaLabel={t("backHome")}
      />
    );
  }

  const session = await getSessionProfile();
  if (!session?.user) {
    redirect({ href: `/signin?next=/p2p/trades/${id}`, locale });
  }

  const supabase = await createClient();
  const { data: trade } = await supabase.from("p2p_trades").select("*").eq("id", id).maybeSingle();
  if (!trade) notFound();

  const [{ data: order }, { data: office }, { data: conversationId }] = await Promise.all([
    trade.order_id
      ? supabase.from("orders").select("*").eq("id", trade.order_id).maybeSingle()
      : Promise.resolve({ data: null }),
    trade.escrow_office_id
      ? supabase.from("exchange_offices").select("*").eq("id", trade.escrow_office_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.rpc("conversation_for_trade", { p_trade: id }),
  ]);

  const chat = conversationId ? await loadConversation(conversationId, locale) : null;

  return (
    <div className="mx-auto max-w-2xl space-y-5 py-4">
      <TradeWorkspace
        trade={trade as P2pTrade}
        order={(order ?? null) as Order | null}
        office={(office ?? null) as ExchangeOffice | null}
        viewerId={session!.user.id}
      />

      {chat ? (
        <Card className="space-y-4 p-5">
          <div>
            <h2 className="text-sm font-semibold">{t("trade.chatTitle")}</h2>
            <p className="mt-1 text-sm text-ink-600">{t("trade.chatBody")}</p>
          </div>
          <Conversation
            conversationId={chat.id}
            viewerId={session!.user.id}
            initialMessages={chat.messages}
            senderNames={chat.senderNames}
          />
        </Card>
      ) : null}
    </div>
  );
}
