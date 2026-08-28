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
import { AppTile } from "@/components/brand/app-tile";
import { Card } from "@/components/ui/card";

/**
 * "How it works" — three supervised steps (§1).
 *
 * `heading` exists because this block is used two ways: as a section on a page
 * that has its own h1, and as the whole of `/how`, where it *is* the page. A
 * page with no h1 fails the outline check, and repeating the title above the
 * section to satisfy it would just say the same thing twice.
 */
export async function HowItWorks({ heading = "h2" }: { heading?: "h1" | "h2" }) {
  const t = await getTranslations("home.how");
  // Three hues rather than three greens: the steps are a sequence, and a
  // sequence drawn in one colour is a list.
  const steps = [
    { icon: FileCheck2, key: "1", hue: "sky" },
    { icon: HandCoins, key: "2", hue: "brand" },
    { icon: ShieldCheck, key: "3", hue: "indigo" },
  ] as const;

  const Heading = heading;

  return (
    <section aria-label={t("title")}>
      <Heading
        className={heading === "h1" ? "text-3xl font-bold sm:text-4xl" : "text-lg font-semibold"}
      >
        {t("title")}
      </Heading>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-600">{t("subtitle")}</p>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {steps.map(({ icon: Icon, key, hue }, index) => (
          <Card key={key} className="relative p-6">
            <span className="num absolute end-5 top-5 text-3xl font-bold text-ink-300/70">
              {index + 1}
            </span>
            <AppTile hue={hue} size="lg">
              <Icon />
            </AppTile>
            <h3 className="mt-4 text-base font-semibold">{t(`steps.${key}.title`)}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{t(`steps.${key}.body`)}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}

/** Trust layer (§17.12) + fee-transparency promise. `heading` as in HowItWorks. */
export async function TrustSection({ heading = "h2" }: { heading?: "h1" | "h2" }) {
  const t = await getTranslations("home.trust");

  const features = [
    { icon: Landmark, key: "licensed", hue: "indigo" },
    { icon: LockKeyhole, key: "rateLock", hue: "brand" },
    { icon: Clock3, key: "sla", hue: "amber" },
    { icon: MessagesSquare, key: "chat", hue: "teal" },
  ] as const;
  const Heading = heading;

  return (
    <section aria-label={t("title")} className="rounded-3xl bg-surface p-6 shadow-e1 sm:p-8">
      <div>
        <Heading
          className={heading === "h1" ? "text-3xl font-bold sm:text-4xl" : "text-lg font-semibold"}
        >
          {t("title")}
        </Heading>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-600">{t("subtitle")}</p>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {features.map(({ icon: Icon, key, hue }) => (
          <div key={key} className="rounded-2xl border border-ink-300/50 p-5">
            <AppTile hue={hue}>
              <Icon />
            </AppTile>
            <h3 className="mt-3 text-sm font-semibold">{t(`items.${key}.title`)}</h3>
            <p className="mt-1 text-sm leading-relaxed text-ink-600">{t(`items.${key}.body`)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
