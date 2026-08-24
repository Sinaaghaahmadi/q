"use client";

import { ArrowLeftRight, ChartNoAxesCombined, House, Menu, ReceiptText } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { useAppMenu } from "@/components/layout/app-menu";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * Bottom tab bar: Home · Rates · Transfer (centre) · Orders · Menu.
 *
 * The customer PWA's chrome, and only the customer's — it used to float over
 * the staff panels too, covering whichever action happened to be at the bottom
 * of the screen.
 *
 * The last slot used to be Profile and is now the menu. Profile has not
 * disappeared; it is the first entry inside, along with accounts, verification
 * and alerts. The trade is one tap on the profile page against a way to reach
 * the twenty-odd destinations that previously existed only in a footer nobody
 * scrolled to.
 */
const STAFF_PREFIXES = ["/office", "/admin"];

export function TabBar() {
  const t = useTranslations("nav");
  const tMenu = useTranslations("menu");
  const pathname = usePathname();
  const { open, setOpen } = useAppMenu();

  if (STAFF_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return null;
  }

  const side = [
    { href: "/", key: "home", icon: House },
    { href: "/rates", key: "rates", icon: ChartNoAxesCombined },
  ] as const;
  const side2 = [{ href: "/orders", key: "orders", icon: ReceiptText }] as const;

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
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            className={itemClass(open)}
          >
            <Menu className="size-5" strokeWidth={open ? 2.4 : 2} />
            {tMenu("title")}
          </button>
        </div>
      </div>
    </nav>
  );
}
