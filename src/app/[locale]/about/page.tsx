import { Compass, HeartHandshake, LifeBuoy, Megaphone, PenTool, Users } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import * as React from "react";
import { TeamMap } from "@/components/about/team-map";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "about" });
  return { title: t("metaTitle") };
}

/** The six disciplines the seventeen are spread across. */
const CRAFTS = [
  { key: "product", icon: PenTool },
  { key: "marketing", icon: Megaphone },
  { key: "bizdev", icon: Compass },
  { key: "strategy", icon: Users },
  { key: "support", icon: LifeBuoy },
  { key: "people", icon: HeartHandshake },
] as const;

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("about");

  return (
    <div className="space-y-12">
      <section className="space-y-4">
        <h1 className="text-3xl font-bold text-balance sm:text-4xl">{t("title")}</h1>
        <p className="max-w-2xl text-base leading-relaxed text-ink-600">{t("lede")}</p>
      </section>

      <TeamMap />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CRAFTS.map(({ key, icon: Icon }) => (
          <Card key={key} className="p-5">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 dark:text-brand-600">
              <Icon className="size-5" aria-hidden />
            </span>
            <h2 className="mt-4 text-sm font-semibold">{t(`crafts.${key}.title`)}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{t(`crafts.${key}.body`)}</p>
          </Card>
        ))}
      </section>

      <section className="rounded-3xl bg-surface p-6 shadow-e1 sm:p-8">
        <h2 className="text-lg font-semibold">{t("mission.title")}</h2>
        <p className="mt-2 max-w-2xl leading-relaxed text-ink-600">{t("mission.body")}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/contact">{t("mission.contact")}</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/how">{t("mission.how")}</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
