import { LifeBuoy } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import * as React from "react";
import { PageHeading } from "@/components/brand/app-tile";
import { Conversation } from "@/components/chat/conversation";
import { EmptyState } from "@/components/layout/empty-state";
import { Card } from "@/components/ui/card";
import { redirect } from "@/i18n/navigation";
import { loadConversation } from "@/lib/chat/load";
import { createClient, getSessionProfile, isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "support" });
  return { title: t("metaTitle") };
}

export default async function SupportPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("support");

  if (!isSupabaseConfigured()) {
    return (
      <EmptyState
        icon={LifeBuoy}
        hue="teal"
        title={t("unavailableTitle")}
        description={t("unavailableBody")}
        ctaLabel={t("backHome")}
      />
    );
  }

  const session = await getSessionProfile();
  if (!session?.user) {
    redirect({ href: "/signin?next=/support", locale });
  }

  const supabase = await createClient();
  // The segment is derived from the caller's own seats, never asked for, so the
  // three queues in /admin/support stay honest (§10.3).
  const { data: conversationId } = await supabase.rpc("conversation_for_support");
  if (!conversationId) {
    return (
      <EmptyState
        icon={LifeBuoy}
        hue="teal"
        title={t("unavailableTitle")}
        description={t("unavailableBody")}
        ctaLabel={t("backHome")}
      />
    );
  }

  const { messages, senderNames } = await loadConversation(conversationId, locale);

  return (
    <div className="mx-auto max-w-2xl space-y-5 py-4">
      <PageHeading hue="teal" icon={<LifeBuoy />} title={t("title")} subtitle={t("subtitle")} />

      <Card className="p-5">
        <Conversation
          conversationId={conversationId}
          viewerId={session!.user.id}
          initialMessages={messages}
          senderNames={senderNames}
        />
      </Card>
    </div>
  );
}
