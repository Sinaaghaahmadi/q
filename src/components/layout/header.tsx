"use client";

import { useTranslations } from "next-intl";
import * as React from "react";
import { LogoLockup } from "@/components/brand/logo";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/rates", key: "rates" },
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
  const pathname = usePathname();

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
          <LocaleSwitcher />
          <ThemeToggle />
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
