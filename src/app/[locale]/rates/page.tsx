import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import * as React from "react";
import { RatesView } from "@/components/rates/rates-view";
import { getSnapshot } from "@/lib/rates/service";

/** ISR: server paint stays ≤5min old; the client then live-refreshes every 60s. */
export const revalidate = 300;

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
  const snapshot = await getSnapshot();
  return <RatesView initialSnapshot={snapshot} />;
}
