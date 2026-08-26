import { FileText, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import * as React from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { ContentEditor } from "@/components/admin/content-editor";
import { EmptyState } from "@/components/layout/empty-state";
import { redirect } from "@/i18n/navigation";
import { getAdminContext } from "@/lib/auth/admin-context";
import { can } from "@/lib/auth/can";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { CmsContent, NotificationTemplate } from "@/lib/supabase/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });
  return { title: t("content.metaTitle") };
}

export default async function AdminContentPage({
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
        icon={FileText}
        hue="slate"
        title={t("unavailableTitle")}
        description={t("unavailableBody")}
        ctaLabel={t("backHome")}
      />
    );
  }

  const ctx = await getAdminContext();
  if (!ctx) redirect({ href: "/signin?next=/admin/content", locale });
  if (!ctx || !can(ctx.seats, "platform.config")) {
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

  // Everything, published or not: `cms_published_read` hands drafts to staff
  // only, and a screen that showed the published half would hide exactly the
  // rows someone came here to finish.
  const [{ data: cms, error: cmsError }, { data: templates, error: templateError }] =
    await Promise.all([
      supabase.from("cms_content").select("*").is("deleted_at", null).order("key").order("locale"),
      supabase
        .from("notification_templates")
        .select("*")
        .is("deleted_at", null)
        .order("key")
        .order("channel")
        .order("locale"),
    ]);

  return (
    <AdminShell
      seats={ctx.seats}
      impersonation={ctx.impersonation}
      office={ctx.impersonatedOffice}
      title={t("content.title")}
      description={t("content.subtitle")}
    >
      {/* A failed read and an empty table are the same `null` here, and this
          screen's whole claim is "everything is written in both languages" —
          made over no rows, that claim is a lie. So a read that errored says so
          instead of rendering an editor that looks finished. */}
      {cmsError || templateError ? (
        <EmptyState
          icon={FileText}
          hue="slate"
          title={t("content.loadFailedTitle")}
          description={t("content.loadFailedBody")}
        />
      ) : (
        <ContentEditor
          cms={(cms ?? []) as CmsContent[]}
          templates={(templates ?? []) as NotificationTemplate[]}
        />
      )}
    </AdminShell>
  );
}
