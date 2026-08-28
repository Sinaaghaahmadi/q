import { Handshake, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import * as React from "react";
import { PageHeading } from "@/components/brand/app-tile";
import { NoAccessScene } from "@/components/brand/scenes/states";
import { EmptyState } from "@/components/layout/empty-state";
import { OfferComposer } from "@/components/p2p/offer-composer";
import { redirect } from "@/i18n/navigation";
import { createClient, getSessionProfile, isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "p2p" });
  return { title: t("compose.metaTitle") };
}

export default async function NewOfferPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("p2p");

  if (!isSupabaseConfigured()) {
    return (
      <EmptyState
        icon={Handshake}
        hue="teal"
        title={t("unavailableTitle")}
        description={t("unavailableBody")}
        ctaLabel={t("backHome")}
      />
    );
  }

  const session = await getSessionProfile();
  if (!session?.user) {
    redirect({ href: "/signin?next=/p2p/new", locale });
  }

  // §9 makes a verified identity a hard requirement to post. The database
  // refuses either way; saying so here saves a pointless round trip.
  if (session?.profile?.kyc_status !== "approved") {
    return (
      <EmptyState
        icon={ShieldAlert}
        scene={NoAccessScene}
        title={t("compose.verifyTitle")}
        description={t("compose.verifyBody")}
        ctaLabel={t("compose.verifyCta")}
        ctaHref="/verify"
      />
    );
  }

  const supabase = await createClient();
  const { data: limits } = await supabase.rpc("p2p_limits");

  return (
    <div className="mx-auto max-w-xl space-y-5 py-4">
      <PageHeading
        hue="teal"
        icon={<Handshake />}
        title={t("compose.title")}
        subtitle={t("compose.subtitle")}
      />
      <OfferComposer limits={limits ?? null} />
    </div>
  );
}
