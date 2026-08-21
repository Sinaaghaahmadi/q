import { BadgeCheck, Clock3, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import * as React from "react";
import { Converter } from "@/components/home/converter";
import { RateStrip } from "@/components/home/rate-strip";
import { HowItWorks, TrustSection } from "@/components/home/sections";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getSnapshot } from "@/lib/rates/service";

/** ISR: server paint stays ≤5min old; the client then live-refreshes every 60s. */
export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });
  return { title: t("metaTitle") };
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const snapshot = await getSnapshot();

  const chips = [
    { icon: Clock3, label: t("hero.chips.sla") },
    { icon: ShieldCheck, label: t("hero.chips.supervised") },
    { icon: BadgeCheck, label: t("hero.chips.kycOnce") },
  ] as const;

  return (
    <div className="space-y-14">
      {/* Hero + inline converter — the product's front door (§0.3) */}
      <section className="grid items-center gap-8 pt-4 lg:grid-cols-2 lg:gap-12">
        <div className="space-y-6">
          <h1 className="text-3xl leading-tight font-bold sm:text-4xl lg:text-5xl">
            {t("hero.title")}
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-ink-600 sm:text-lg">
            {t("hero.subtitle")}
          </p>
          <ul className="flex flex-wrap gap-2">
            {chips.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full border border-ink-300/60 bg-surface px-3 py-1.5 text-xs font-medium text-ink-600"
              >
                <Icon className="size-3.5 text-brand-600" aria-hidden />
                {label}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/transfer/new">{t("hero.ctaPrimary")}</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/rates">{t("hero.ctaSecondary")}</Link>
            </Button>
          </div>
        </div>
        <Converter initialSnapshot={snapshot} />
      </section>

      <RateStrip initialSnapshot={snapshot} />
      <HowItWorks />
      <TrustSection />
    </div>
  );
}
