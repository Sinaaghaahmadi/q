import { UserRound } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import * as React from "react";
import { ProfileView } from "@/components/auth/profile-view";
import { TierAndReferral } from "@/components/auth/tier-referral";
import { EmptyState } from "@/components/layout/empty-state";
import { redirect } from "@/i18n/navigation";
import { createClient, getSessionProfile, isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "profile" });
  return { title: t("metaTitle") };
}

export default async function ProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("profile");

  if (!isSupabaseConfigured()) {
    return (
      <EmptyState
        icon={UserRound}
        title={t("emptyTitle")}
        description={t("emptyBody")}
        phaseLabel={t("phase")}
        ctaLabel={t("cta")}
      />
    );
  }

  const session = await getSessionProfile();
  if (!session?.user) {
    redirect({ href: "/signin?next=/profile", locale });
  }

  const supabase = await createClient();
  const [{ data: events }, { data: tier }, { data: referrals }] = await Promise.all([
    supabase.from("login_events").select("*").order("created_at", { ascending: false }).limit(10),
    supabase.rpc("customer_tier", {}),
    supabase.from("referrals").select("*"),
  ]);

  const mine = (referrals ?? []).filter((r) => r.referrer_id === session!.user.id);

  return (
    <div className="space-y-5 py-4">
      <ProfileView
        profile={session?.profile ?? null}
        email={session?.user.email ?? null}
        events={events ?? []}
      />
      <TierAndReferral
        tier={tier ?? null}
        referralCode={session?.profile?.referral_code ?? null}
        invited={mine.length}
        rewarded={mine.filter((r) => r.rewarded_at !== null).length}
        alreadyReferred={(referrals ?? []).some((r) => r.referee_id === session!.user.id)}
      />
    </div>
  );
}
