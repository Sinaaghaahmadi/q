import { Clock3, ListChecks, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import * as React from "react";
import { TicketComposer } from "@/components/support/ticket-composer";
import { Card } from "@/components/ui/card";
import { getSessionProfile, isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contact" });
  return { title: t("metaTitle") };
}

/** What happens after you press send — stated before you press it. */
const PROMISES = [
  { key: "tracked", icon: ListChecks },
  { key: "answered", icon: Clock3 },
  { key: "escalates", icon: ShieldCheck },
] as const;

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("contact");

  const session = isSupabaseConfigured() ? await getSessionProfile() : null;

  return (
    <div className="space-y-8">
      <div className="max-w-2xl space-y-3">
        <h1 className="text-3xl font-bold text-balance sm:text-4xl">{t("title")}</h1>
        <p className="text-base leading-relaxed text-ink-600">{t("lede")}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <TicketComposer signedIn={Boolean(session?.user)} />

        <aside className="space-y-3">
          {PROMISES.map(({ key, icon: Icon }) => (
            <Card key={key} className="p-5">
              <Icon className="size-5 text-brand-600" aria-hidden />
              <h2 className="mt-3 text-sm font-semibold">{t(`promises.${key}.title`)}</h2>
              <p className="mt-1 text-sm leading-relaxed text-ink-600">
                {t(`promises.${key}.body`)}
              </p>
            </Card>
          ))}
        </aside>
      </div>
    </div>
  );
}
