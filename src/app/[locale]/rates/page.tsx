import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import * as React from "react";
import { RatesView } from "@/components/rates/rates-view";
import { getSnapshot } from "@/lib/rates/service";
import { getSessionProfile, isSupabaseConfigured } from "@/lib/supabase/server";

/**
 * Per-request rather than ISR: the alert sheet needs to know whether there is
 * an account behind the visitor, and a cached "sign in first" served to someone
 * already signed in is a worse bug than a slightly slower page. The client
 * still live-refreshes the prices every 60s.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ratesPage" });
  return { title: t("metaTitle") };
}

export default async function RatesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [snapshot, session] = await Promise.all([
    getSnapshot(),
    isSupabaseConfigured() ? getSessionProfile() : Promise.resolve(null),
  ]);
  return <RatesView initialSnapshot={snapshot} signedIn={Boolean(session?.user)} />;
}
