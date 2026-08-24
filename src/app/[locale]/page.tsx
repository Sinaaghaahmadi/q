import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import * as React from "react";
import { Converter } from "@/components/home/converter";
import { RateStrip } from "@/components/home/rate-strip";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getSnapshot } from "@/lib/rates/service";

/**
 * The first paint must not be older than the refresh promise made everywhere
 * else. Thirty seconds matches `RATES_REFRESH_MS`, so the figure a visitor sees
 * before React has hydrated is the same age as the one they see after.
 */
export const revalidate = 30;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });
  return { title: t("metaTitle") };
}

/**
 * The front door, and now only the front door.
 *
 * It used to carry a paragraph of explanation, three reassurance chips, a
 * three-step "how it works" and a four-card trust section under the fold. All
 * of it was true and none of it was what someone opens this page for: the rate
 * today, and a way to start. The explanation now lives at `/how` and `/why`,
 * linked from the footer — the same content, reached by the people who want it
 * instead of scrolled past by the people who don't.
 *
 * What stays is what §0.3 makes non-negotiable: a live rate and a working
 * converter, before any login, plus exactly two ways forward.
 */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const snapshot = await getSnapshot();

  return (
    <div className="space-y-14">
      <section className="grid items-center gap-8 pt-4 lg:grid-cols-2 lg:gap-12">
        <div className="space-y-8">
          <h1 className="text-4xl leading-tight font-bold text-balance sm:text-5xl lg:text-6xl">
            {t("hero.title")}
          </h1>
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
    </div>
  );
}
