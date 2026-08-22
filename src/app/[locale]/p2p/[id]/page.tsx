import { Handshake } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import * as React from "react";
import { EmptyState } from "@/components/layout/empty-state";
import { OfferDetail } from "@/components/p2p/offer-detail";
import { createClient, getSessionProfile, isSupabaseConfigured } from "@/lib/supabase/server";
import type { P2pOffer, Reputation } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "p2p" });
  return { title: t("metaTitle") };
}

export default async function OfferPage({
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

  const supabase = await createClient();
  const session = await getSessionProfile();

  const { data: offer } = await supabase.from("p2p_offers").select("*").eq("id", id).maybeSingle();
  if (!offer) notFound();

  const [{ data: maker }, { data: reputation }, { data: trades }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name_fa, full_name_latin")
      .eq("id", offer.user_id)
      .maybeSingle(),
    supabase.from("reputation").select("*").eq("user_id", offer.user_id).maybeSingle(),
    // Only what the viewer may see; RLS keeps other people's trades out.
    supabase.from("p2p_trades").select("*").eq("offer_id", id),
  ]);

  const makerName =
    (locale === "fa"
      ? (maker?.full_name_fa ?? maker?.full_name_latin)
      : (maker?.full_name_latin ?? maker?.full_name_fa)) ?? null;

  return (
    <div className="mx-auto max-w-2xl space-y-5 py-4">
      <OfferDetail
        offer={offer as P2pOffer}
        makerName={makerName}
        reputation={(reputation ?? null) as Reputation | null}
        myTradeId={(trades ?? []).find((tr) => tr.taker_id === session?.user.id)?.id ?? null}
        viewerId={session?.user.id ?? null}
        verified={session?.profile?.kyc_status === "approved"}
      />
    </div>
  );
}
