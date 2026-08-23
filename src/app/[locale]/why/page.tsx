import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import * as React from "react";
import { TrustSection } from "@/components/home/sections";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/**
 * "Why Asa" — the trust layer, off the front door for the same reason as §how:
 * a reassurance nobody asked for yet is noise above the fold and an answer
 * below it.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home.trust" });
  return { title: t("title") };
}

export default async function WhyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");

  return (
    <div className="space-y-10">
      <TrustSection heading="h1" />
      <div className="flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link href="/transfer/new">{t("hero.ctaPrimary")}</Link>
        </Button>
        <Button asChild size="lg" variant="secondary">
          <Link href="/how">{t("how.title")}</Link>
        </Button>
      </div>
    </div>
  );
}
