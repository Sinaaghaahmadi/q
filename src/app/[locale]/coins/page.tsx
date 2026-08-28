import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import * as React from "react";
import { CoinsBoard } from "@/components/coins/coins-board";
import { getCoinSnapshot } from "@/lib/coins/service";
import type { AppLocale } from "@/lib/money/format";
import { getSessionProfile, isSupabaseConfigured } from "@/lib/supabase/server";

/**
 * Dynamic rather than ISR, unlike the currency board: this page knows whether
 * the reader is signed in, and a cached "sign in first" shown to somebody who
 * already is would be a worse bug than a slightly slower page.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "coins" });
  return { title: t("metaTitle"), description: t("subtitle") };
}

export default async function CoinsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [snapshot, session] = await Promise.all([
    getCoinSnapshot(),
    isSupabaseConfigured() ? getSessionProfile() : Promise.resolve(null),
  ]);

  return (
    <CoinsBoard
      snapshot={snapshot}
      locale={locale as AppLocale}
      signedIn={Boolean(session?.user)}
    />
  );
}
