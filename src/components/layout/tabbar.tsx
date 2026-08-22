"use client";

import { ArrowLeftRight, ChartNoAxesCombined, House, ReceiptText, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/** Bottom tab bar (§4.1): Home · Rates · Transfer (center FAB) · Orders · Profile. */
export function TabBar() {
  const t = useTranslations("nav");
  const pathname = usePathname();

  const side = [
    { href: "/", key: "home", icon: House },
    { href: "/rates", key: "rates", icon: ChartNoAxesCombined },
  ] as const;
  const side2 = [
    { href: "/orders", key: "orders", icon: ReceiptText },
    { href: "/profile", key: "profile", icon: UserRound },
  ] as const;

  function Item({ href, k, Icon }: { href: string; k: string; Icon: typeof House }) {
    const active = pathname === href;
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-w-14 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[0.6875rem] font-medium transition-colors",
          active ? "text-brand-600" : "text-ink-600 hover:text-ink-900",
        )}
      >
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
