"use client";

import { ArrowLeftRight, ChartNoAxesCombined, CircleUser, House, ReceiptText } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { useAppMenu } from "@/components/layout/app-menu";
import { Link, usePathname } from "@/i18n/navigation";
import { isPanelRoute } from "@/lib/panel-routes";
import { cn } from "@/lib/utils";

/**
 * Bottom tab bar: Home · Rates · Transfer (centre) · Orders · Profile.
 *
 * The customer PWA's chrome, and only the customer's — it used to float over
 * the staff panels too, covering whichever action happened to be at the bottom
 * of the screen.
 *
 * The last slot was the menu, which is the wrong thing to give a permanent seat
 * to: five slots are the five places somebody goes, and "a list of places" is
 * not one of them. It is the profile now — the account, its saved accounts, its
 * identity and its alerts — and everything that used to be behind that tab is
 * behind the hamburger in the header, which is where a phone puts the rest.
 *
 * Signed out, the same slot says so and leads to sign-in. A tab labelled
 * "profile" that bounces to a login wall is a tap that lied.
 */

export function TabBar() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const { signedIn } = useAppMenu();

  if (isPanelRoute(pathname)) return null;

  const side = [
    { href: "/", key: "home", icon: House },
    { href: "/rates", key: "rates", icon: ChartNoAxesCombined },
  ] as const;
  const side2 = [
    { href: "/orders", key: "orders", icon: ReceiptText },
    signedIn
      ? ({ href: "/profile", key: "profile", icon: CircleUser } as const)
      : ({ href: "/signin", key: "signin", icon: CircleUser } as const),
  ] as const;

  const itemClass = (active: boolean) =>
    cn(
      "flex min-w-14 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[0.6875rem] font-medium transition-colors",
      active ? "text-brand-600" : "text-ink-600 hover:text-ink-900",
    );

  function Item({ href, k, Icon }: { href: string; k: string; Icon: typeof House }) {
    const active = pathname === href;
    return (
      <Link href={href} aria-current={active ? "page" : undefined} className={itemClass(active)}>
        <Icon className="size-5" strokeWidth={active ? 2.4 : 2} />
        {t(k)}
      </Link>
    );
  }

  return (
    <nav
      aria-label={t("primary")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-300/40 bg-surface/92 backdrop-blur-md md:hidden"
    >
      <div className="pb-safe">
        <div className="mx-auto flex h-16 max-w-md items-center justify-between px-4">
          {side.map((i) => (
            <Item key={i.href} href={i.href} k={i.key} Icon={i.icon} />
          ))}
          <Link
            href="/transfer/new"
            aria-label={t("startTransfer")}
            className="-mt-7 flex size-14 items-center justify-center rounded-full bg-brand-solid text-white shadow-e2 transition-transform hover:bg-brand-700 active:scale-95"
          >
            <ArrowLeftRight className="size-6" />
          </Link>
          {side2.map((i) => (
            <Item key={i.href} href={i.href} k={i.key} Icon={i.icon} />
          ))}
        </div>
      </div>
    </nav>
  );
}
