"use client";

import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { LogoLockup } from "@/components/brand/logo";
import { useAppMenu } from "@/components/layout/app-menu";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { Link, usePathname } from "@/i18n/navigation";
import { isPanelRoute } from "@/lib/panel-routes";
import { cn } from "@/lib/utils";

/**
 * The header carries the few destinations a visit is usually about; everything
 * else lives in the menu, which is one tap away at every width. Five links is
 * about where a horizontal bar stops being scannable, so the list stops there.
 */
const NAV_ITEMS = [
  { href: "/rates", key: "rates" },
  { href: "/coins", key: "coins" },
  { href: "/transfer/new", key: "transfer" },
  { href: "/p2p", key: "p2p" },
  { href: "/orders", key: "orders" },
] as const;

export function Header({
  signedIn = false,
  officeMember = false,
  platformStaff = false,
}: {
  signedIn?: boolean;
  officeMember?: boolean;
  platformStaff?: boolean;
}) {
  const t = useTranslations("nav");
  const tMenu = useTranslations("menu");
  const pathname = usePathname();
  const { setOpen } = useAppMenu();

  // A staff panel gets `PanelTopBar` instead. Six links to buy currency across
  // the top of a management console is the shop's furniture in somebody else's
  // room.
  if (isPanelRoute(pathname)) return null;

  return (
    <header className="sticky top-0 z-40 border-b border-ink-300/40 bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" aria-label={t("home")} className="shrink-0">
          <LogoLockup animated />
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label={t("primary")}>
          {[
            ...NAV_ITEMS,
            // Only staff have a panel, so only staff see the way to it.
            ...(officeMember ? [{ href: "/office", key: "office" } as const] : []),
            ...(platformStaff ? [{ href: "/admin", key: "admin" } as const] : []),
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                pathname === item.href
                  ? "bg-brand-50 text-brand-700 dark:text-brand-600"
                  : "text-ink-600 hover:bg-ink-300/20 hover:text-ink-900",
              )}
            >
              {t(item.key)}
            </Link>
          ))}
        </nav>

        <div className="ms-auto flex items-center gap-1.5">
          <span className="hidden items-center gap-1.5 md:inline-flex">
            <LocaleSwitcher />
            <ThemeToggle />
          </span>
          {/* The way into everything that is not one of the five links above.
              Present at every width — on a phone it is the only nav besides
              the tab bar, on a desktop it is where the old footer went. */}
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={tMenu("title")}
            className="inline-flex size-9 items-center justify-center rounded-lg text-ink-600 transition-colors hover:bg-ink-300/20 hover:text-ink-900"
          >
            <Menu className="size-5" aria-hidden />
          </button>
          {signedIn ? (
            <Button asChild size="sm" variant="secondary" className="hidden md:inline-flex">
              <Link href="/profile">{t("profile")}</Link>
            </Button>
          ) : (
            <Button asChild size="sm" className="hidden md:inline-flex">
              <Link href="/signin">{t("signin")}</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
