import { CircleDollarSign, Handshake, PackageSearch } from "lucide-react";
import { getTranslations } from "next-intl/server";
import * as React from "react";
import { AppTile } from "@/components/brand/app-tile";
import { Link } from "@/i18n/navigation";

/**
 * The three services that are not a tab, on the screen everybody opens first.
 *
 * They used to be a group in the navigation sheet, which is where a thing goes
 * when nobody has decided where it belongs: buying gold and the peer market are
 * products, not settings, and burying a product two taps behind a hamburger is
 * a decision about how much you want it used. Tracking an order is the one
 * thing on the site somebody does *without* an account, which makes the menu —
 * closed by default — the worst possible place for it.
 *
 * Cards rather than list rows, because this sits on a page with room rather
 * than inside a panel, and because a tap target the size of a card is the
 * difference between a service and a footnote.
 */
const SERVICES = [
  { href: "/coins", key: "coins", hue: "amber", icon: CircleDollarSign },
  { href: "/p2p", key: "p2p", hue: "teal", icon: Handshake },
  { href: "/t", key: "track", hue: "sky", icon: PackageSearch },
] as const;

export async function HomeServices() {
  const t = await getTranslations("home.services");

  return (
    <section aria-labelledby="home-services" className="space-y-4">
      <h2 id="home-services" className="text-lg font-semibold">
        {t("title")}
      </h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {SERVICES.map((service) => (
          <Link
            key={service.href}
            href={service.href}
            className="glass glass-lift pressable flex items-center gap-3.5 rounded-2xl p-4 [--glass-tint:transparent]"
          >
            <AppTile hue={service.hue} size="lg">
              <service.icon />
            </AppTile>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{t(`${service.key}.title`)}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-ink-600">
                {t(`${service.key}.body`)}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
