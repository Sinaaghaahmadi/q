"use client";

import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { useAppMenu } from "@/components/layout/app-menu";
import { Link, usePathname } from "@/i18n/navigation";
import { isPanelRoute } from "@/lib/panel-routes";
import { versionLabel } from "@/lib/version";

/**
 * One line, not four columns.
 *
 * Everything this used to hold — product links, company pages, the legal set —
 * is in the menu now, reachable from the tab bar and the header on every screen
 * rather than only at the bottom of one. What is left is what a footer is
 * actually for: who runs this, which version you are looking at, and the two
 * documents a reader is entitled to find without hunting.
 */
export function Footer() {
  const t = useTranslations("footer");
  const tMenu = useTranslations("menu");
  const tLegal = useTranslations("legal.titles");
  const { setOpen } = useAppMenu();
  const pathname = usePathname();

  // Not on a panel. A console ends where its content ends; a marketing footer
  // under it is one more thing to scroll past on every screen.
  if (isPanelRoute(pathname)) return null;

  return (
    <footer className="mt-14 border-t border-ink-300/40 bg-surface pb-24 md:pb-0">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-3 px-4 py-5 text-xs text-ink-600 sm:px-6">
        <p className="font-medium text-ink-900">{t("brand")}</p>
        <p>{t("copyright")}</p>

        <nav aria-label={t("legal")} className="flex items-center gap-4">
          <Link className="hover:text-ink-900" href="/legal/terms">
            {tLegal("terms")}
          </Link>
          <Link className="hover:text-ink-900" href="/legal/privacy">
            {tLegal("privacy")}
          </Link>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 hover:text-ink-900"
          >
            <Menu className="size-3.5" aria-hidden />
            {tMenu("title")}
          </button>
        </nav>

        <p className="ms-auto font-mono" dir="ltr">
          {tMenu("version", { version: versionLabel() })}
        </p>
      </div>
    </footer>
  );
}
