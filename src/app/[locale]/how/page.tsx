import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import * as React from "react";
import { HowItWorks } from "@/components/home/sections";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/**
 * "How a transfer works", lifted off the front door.
 *
 * It used to sit below the converter, where it competed with the two things
 * the home page is actually for — a live rate and a way to start. Someone who
 * already knows how a hawala works scrolled past it every visit; someone who
 * did not got three cards in the corner of their eye. It reads better as its
 * own page, reachable from the footer and from the transfer flow.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home.how" });
  return { title: t("title") };
}

export default async function HowPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");

  return (
    <div className="space-y-10">
      <HowItWorks heading="h1" />
      <div className="flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link href="/transfer/new">{t("hero.ctaPrimary")}</Link>
        </Button>
        <Button asChild size="lg" variant="secondary">
          <Link href="/why">{t("trust.title")}</Link>
        </Button>
      </div>
    </div>
  );
}
