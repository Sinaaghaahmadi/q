import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { LEGAL_CONTENT, LEGAL_SLUGS, type LegalSlug } from "@/content/legal";
import { routing } from "@/i18n/routing";
import { formatDate, type AppLocale } from "@/lib/money/format";

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => LEGAL_SLUGS.map((slug) => ({ locale, slug })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!LEGAL_SLUGS.includes(slug as LegalSlug)) return {};
  const t = await getTranslations({ locale, namespace: "legal.titles" });
  return { title: t(slug as LegalSlug) };
}

export default async function LegalPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  if (!LEGAL_SLUGS.includes(slug as LegalSlug)) notFound();

  const appLocale = locale as AppLocale;
  // Legal text exists in Persian and English only, and deliberately so: a
  // terms-of-service nobody has had reviewed in a jurisdiction is a liability,
  // not a feature. Arabic and French readers get the English document — which
  // is a real document somebody signed off — rather than a translation of one.
  const legalLocale: "fa" | "en" = locale === "fa" ? "fa" : "en";
  const doc = LEGAL_CONTENT[slug as LegalSlug][legalLocale];
  const t = await getTranslations("legal");
  const titles = await getTranslations("legal.titles");

  return (
    <article className="mx-auto max-w-2xl space-y-8 py-4">
      <header className="space-y-3">
        <h1 className="text-2xl font-bold">{titles(slug as LegalSlug)}</h1>
        <p className="leading-relaxed text-ink-600">{doc.intro}</p>
        <p className="flex flex-wrap items-center gap-2 text-xs text-ink-600">
          <Badge variant="outline">{t("version", { version: doc.version })}</Badge>
          <span>{t("updated", { date: formatDate(doc.updated, appLocale) })}</span>
        </p>
      </header>
      {doc.sections.map((section) => (
        <section key={section.h} className="space-y-2.5">
          <h2 className="text-lg font-semibold">{section.h}</h2>
          {section.ps.map((p, i) => (
            <p key={i} className="leading-relaxed text-ink-600">
              {p}
            </p>
          ))}
        </section>
      ))}
    </article>
  );
}
