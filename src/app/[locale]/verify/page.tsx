import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import * as React from "react";
import { EmptyState } from "@/components/layout/empty-state";
import { KycWizard } from "@/components/kyc/wizard";
import { redirect } from "@/i18n/navigation";
import { createClient, getSessionProfile, isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "kyc" });
  return { title: t("metaTitle") };
}

export default async function VerifyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("kyc");

  if (!isSupabaseConfigured()) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title={t("unavailableTitle")}
        description={t("unavailableBody")}
        ctaLabel={t("backHome")}
      />
    );
  }

  const session = await getSessionProfile();
  if (!session?.user) {
    redirect({ href: "/signin?next=/verify", locale });
  }

  // `kyc.ocr` decides whether the document reader is offered at all. Reading it
  // here rather than in the client keeps the five-megabyte engine out of reach
  // of a browser whose flag is off — a client-side check would still ship the
  // button and the dynamic import behind it.
  const supabase = await createClient();
  const { data: flag } = await supabase
    .from("feature_flags")
    .select("enabled")
    .eq("key", "kyc.ocr")
    .is("deleted_at", null)
    .maybeSingle();

  return (
    <div className="py-4">
      <KycWizard
        initialName={session?.profile?.full_name_fa ?? null}
        initialStatus={session?.profile?.kyc_status ?? null}
        ocrEnabled={flag?.enabled === true}
      />
    </div>
  );
}
