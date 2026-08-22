import { Compass } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import * as React from "react";
import { EmptyState } from "@/components/layout/empty-state";
import { PublicStatus, type PublicStatusPayload } from "@/components/orders/public-status";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; ref: string }>;
}): Promise<Metadata> {
  const { locale, ref } = await params;
  const t = await getTranslations({ locale, namespace: "track" });
  return {
    title: t("metaTitle", { ref: ref.toUpperCase() }),
    // A tracking link is not a page for a search engine to hold onto.
    robots: { index: false, follow: false },
  };
}

/**
 * The shareable status page (§17.2): a recipient abroad follows the transfer
 * without an account. Everything on it comes from `order_public_status`, which
 * returns a deliberately thin payload — state, dates, what is arriving, which
 * office — and carries its own rate limit, because a six-character reference is
 * a display identifier rather than a secret.
 */
export default async function TrackPage({
  params,
}: {
  params: Promise<{ locale: string; ref: string }>;
}) {
  const { locale, ref } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("track");

  if (!isSupabaseConfigured()) {
    return (
      <EmptyState
        icon={Compass}
        title={t("unavailableTitle")}
        description={t("unavailableBody")}
        ctaLabel={t("backHome")}
      />
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("order_public_status", { p_ref: ref });
  const payload = (data ?? null) as PublicStatusPayload | null;

  if (error) {
    return (
      <EmptyState
        icon={Compass}
        title={t("throttledTitle")}
        description={t("throttledBody")}
        ctaLabel={t("backHome")}
      />
    );
  }

  if (!payload?.found) {
    return (
      <EmptyState
        icon={Compass}
        title={t("notFoundTitle")}
        description={t("notFoundBody")}
        ctaLabel={t("backHome")}
      />
    );
  }

  return (
    <div className="mx-auto max-w-lg py-4">
      <PublicStatus status={payload} />
    </div>
  );
}
