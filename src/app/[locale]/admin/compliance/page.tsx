import { ScrollText, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import * as React from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  ComplianceView,
  type FlaggedMessage,
  type SanctionsRow,
} from "@/components/admin/compliance-view";
import { EmptyState } from "@/components/layout/empty-state";
import { THRESHOLD_KEYS } from "@/lib/admin/filters";
import { redirect } from "@/i18n/navigation";
import { getAdminContext } from "@/lib/auth/admin-context";
import { can } from "@/lib/auth/can";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { Conversation, Message, PlatformSetting, SanctionsHit } from "@/lib/supabase/types";

/** Only the columns the flag list shows; a message body is read here, not stored. */
type FlaggedRow = Pick<Message, "id" | "conversation_id" | "body" | "flags" | "created_at">;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });
  return { title: t("compliance.metaTitle") };
}

export default async function AdminCompliancePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  if (!isSupabaseConfigured()) {
    return (
      <EmptyState
        icon={ScrollText}
        hue="slate"
        title={t("unavailableTitle")}
        description={t("unavailableBody")}
        ctaLabel={t("backHome")}
      />
    );
  }

  const ctx = await getAdminContext();
  if (!ctx) redirect({ href: "/signin?next=/admin/compliance", locale });
  if (!ctx || !can(ctx.seats, "platform.audit")) {
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

  const supabase = await createClient();
  const [{ data: hits }, { data: flagged }, { data: settings }] = await Promise.all([
    supabase
      .from("sanctions_hits")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(100),
    // `flags` is `jsonb_strip_nulls`-ed on write, so an empty object is exactly
    // the "nothing tripped" case and the only thing worth excluding.
    supabase
      .from("messages")
      .select("id, conversation_id, body, flags, created_at")
      .neq("flags", "{}")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("settings")
      .select("*")
      .in("key", [...THRESHOLD_KEYS]),
  ]);

  const hitRows = (hits ?? []) as SanctionsHit[];
  const messageRows = (flagged ?? []) as FlaggedRow[];

  const subjectIds = [...new Set(hitRows.map((hit) => hit.user_id))];
  const profiles = subjectIds.length
    ? ((
        await supabase
          .from("profiles")
          .select("id, full_name_fa, full_name_latin")
          .in("id", subjectIds)
      ).data ?? [])
    : [];
  const names = new Map(profiles.map((p) => [p.id, p]));

  const conversationIds = [...new Set(messageRows.map((m) => m.conversation_id))];
  const threads: Pick<Conversation, "id" | "kind" | "subject_id" | "segment">[] =
    conversationIds.length
      ? ((
          await supabase
            .from("conversations")
            .select("id, kind, subject_id, segment")
            .in("id", conversationIds)
        ).data ?? [])
      : [];
  const threadById = new Map(threads.map((c) => [c.id, c]));

  const sanctions: SanctionsRow[] = hitRows.map((hit) => ({
    ...hit,
    nameFa: names.get(hit.user_id)?.full_name_fa ?? null,
    nameLatin: names.get(hit.user_id)?.full_name_latin ?? null,
  }));

  const messages: FlaggedMessage[] = messageRows.map((message) => {
    const thread = threadById.get(message.conversation_id);
    return {
      ...message,
      kind: thread?.kind ?? null,
      subjectId: thread?.subject_id ?? null,
      segment: thread?.segment ?? null,
    };
  });

  return (
    <AdminShell
      seats={ctx.seats}
      impersonation={ctx.impersonation}
      office={ctx.impersonatedOffice}
      title={t("compliance.title")}
      description={t("compliance.subtitle")}
    >
      <ComplianceView
        hits={sanctions}
        flagged={messages}
        settings={(settings ?? []) as PlatformSetting[]}
        canEditThresholds={can(ctx.seats, "platform.config")}
      />
    </AdminShell>
  );
}
