import { LifeBuoy, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import * as React from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { SupportInbox } from "@/components/admin/support-inbox";
import { EmptyState } from "@/components/layout/empty-state";
import { redirect } from "@/i18n/navigation";
import { getAdminContext } from "@/lib/auth/admin-context";
import { isPlatformStaff } from "@/lib/auth/can";
import { loadConversation } from "@/lib/chat/load";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { Conversation, Message, SupportSegment } from "@/lib/supabase/types";

const SEGMENTS: SupportSegment[] = ["customer", "p2p", "office"];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });
  return { title: t("support.metaTitle") };
}

export default async function AdminSupportPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ segment?: string; thread?: string }>;
}) {
  const { locale } = await params;
  const { segment, thread } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

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

  const ctx = await getAdminContext();
  if (!ctx) redirect({ href: "/signin?next=/admin/support", locale });
  if (!ctx || !isPlatformStaff(ctx.seats)) {
    return (
      <EmptyState
        icon={ShieldAlert}
        hue="indigo"
        title={t("forbiddenTitle")}
        description={t("forbiddenBody")}
        ctaLabel={t("backHome")}
      />
    );
  }

  const active = (SEGMENTS as string[]).includes(segment ?? "")
    ? (segment as SupportSegment)
    : "customer";

  const supabase = await createClient();
  const { data: conversations } = await supabase
    .from("conversations")
    .select("*")
    .eq("kind", "support")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(200);

  const all = (conversations ?? []) as Conversation[];
  const inSegment = all.filter((c) => c.segment === active);
  const openThread = thread && inSegment.some((c) => c.id === thread) ? thread : null;

  let messages: Message[] = [];
  let senderNames: Record<string, string> = {};
  if (openThread) {
    const loaded = await loadConversation(openThread, locale);
    messages = loaded.messages;
    senderNames = loaded.senderNames;
  }

  return (
    <AdminShell
      seats={ctx.seats}
      impersonation={ctx.impersonation}
      office={ctx.impersonatedOffice}
      title={t("support.title")}
      description={t("support.subtitle")}
    >
      <SupportInbox
        segments={SEGMENTS.map((s) => ({
          key: s,
          count: all.filter((c) => c.segment === s).length,
        }))}
        activeSegment={active}
        conversations={inSegment}
        openThread={openThread}
        messages={messages}
        senderNames={senderNames}
        viewerId={ctx.userId}
      />
    </AdminShell>
  );
}
