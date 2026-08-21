import {
  Clock3,
  FileCheck2,
  HandCoins,
  Landmark,
  LockKeyhole,
  MessagesSquare,
  ShieldCheck,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import * as React from "react";
import { Card } from "@/components/ui/card";

/** "How it works" — three supervised steps (§1). */
export async function HowItWorks() {
  const t = await getTranslations("home.how");
  const steps = [
    { icon: FileCheck2, key: "1" },
    { icon: HandCoins, key: "2" },
    { icon: ShieldCheck, key: "3" },
  ] as const;

  return (
    <section aria-label={t("title")}>
      <h2 className="text-lg font-semibold">{t("title")}</h2>
      <p className="mt-1 max-w-2xl text-sm text-ink-600">{t("subtitle")}</p>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {steps.map(({ icon: Icon, key }, index) => (
          <Card key={key} className="relative p-6">
            <span className="num absolute end-5 top-5 text-3xl font-bold text-ink-300/70">
              {index + 1}
            </span>
            <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 dark:text-brand-600">
              <Icon className="size-6" aria-hidden />
            </span>
            <h3 className="mt-4 text-base font-semibold">{t(`steps.${key}.title`)}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{t(`steps.${key}.body`)}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}

/** Trust layer (§17.12) + fee-transparency promise. */
export async function TrustSection() {
  const t = await getTranslations("home.trust");

  const features = [
    { icon: Landmark, key: "licensed" },
    { icon: LockKeyhole, key: "rateLock" },
    { icon: Clock3, key: "sla" },
    { icon: MessagesSquare, key: "chat" },
  ] as const;

  return (
    <section aria-label={t("title")} className="rounded-3xl bg-surface p-6 shadow-e1 sm:p-8">
      <div>
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <p className="mt-1 max-w-xl text-sm text-ink-600">{t("subtitle")}</p>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {features.map(({ icon: Icon, key }) => (
          <div key={key} className="rounded-2xl border border-ink-300/50 p-5">
            <Icon className="size-5 text-brand-600" aria-hidden />
            <h3 className="mt-3 text-sm font-semibold">{t(`items.${key}.title`)}</h3>
            <p className="mt-1 text-sm leading-relaxed text-ink-600">{t(`items.${key}.body`)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
