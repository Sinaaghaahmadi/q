import { Handshake } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import * as React from "react";
import { OfferBoard } from "@/components/p2p/offer-board";
import { EmptyState } from "@/components/layout/empty-state";
import { createClient, getSessionProfile, isSupabaseConfigured } from "@/lib/supabase/server";
import type { P2pOffer, Profile, Reputation } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "p2p" });
  return { title: t("metaTitle"), description: t("subtitle") };
}

/**
 * The offer board (§9). Public: browsing is how people decide whether the
 * marketplace is worth verifying for. Posting and taking both require an
 * approved identity, and the database says so rather than this page.
 */
export default async function P2pBoardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
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

  const { data: offers } = await supabase
    .from("p2p_offers")
    .select("*")
    .eq("status", "open")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = (offers ?? []) as P2pOffer[];
  const makerIds = [...new Set(rows.map((o) => o.user_id))];

  const [{ data: profiles }, { data: reputations }] = await Promise.all([
    makerIds.length
      ? supabase.from("profiles").select("id, full_name_fa, full_name_latin").in("id", makerIds)
      : Promise.resolve({ data: [] as Pick<Profile, "id" | "full_name_fa" | "full_name_latin">[] }),
    makerIds.length
      ? supabase.from("reputation").select("*").in("user_id", makerIds)
      : Promise.resolve({ data: [] as Reputation[] }),
  ]);

  const names: Record<string, string> = {};
  for (const p of profiles ?? []) {
    const name =
      locale === "fa"
        ? (p.full_name_fa ?? p.full_name_latin)
        : (p.full_name_latin ?? p.full_name_fa);
    if (name) names[p.id] = name;
  }

  return (
    <div className="space-y-5 py-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-600">{t("subtitle")}</p>
      </div>

      <OfferBoard
        offers={rows}
        names={names}
        reputations={(reputations ?? []) as Reputation[]}
        viewerId={session?.user.id ?? null}
        verified={session?.profile?.kyc_status === "approved"}
      />
    </div>
  );
}
