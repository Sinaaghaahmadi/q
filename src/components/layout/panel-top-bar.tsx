"use client";

import { ArrowUpRight, LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { LogoLockup } from "@/components/brand/logo";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Link, useRouter } from "@/i18n/navigation";

/**
 * The bar a console wears instead of the shop's.
 *
 * Four things, and nothing else: whose product this is, which panel you are in,
 * who you are signed in as, and the way out. The customer header carried six
 * links to buy currency, a theme toggle, a language switcher and a menu button
 * — all correct on a shop, all noise above a screen for moving other people's
 * money.
 *
 * The role is printed rather than implied. An administrator who also holds an
 * office seat can be in either panel, and "which powers am I using right now"
 * is the question behind most mistakes in a tool like this.
 */
export function PanelTopBar({
  panel,
  who,
  role,
}: {
  panel: "admin" | "office";
  /** Display name of the signed-in person, or their identifier. */
  who: string;
  /** What they are here as — already translated by the caller. */
  role?: string;
}) {
  const t = useTranslations("panel");
  const router = useRouter();
  const [leaving, setLeaving] = React.useState(false);

  /*
   * Sign out, then leave.
   *
   * A plain `<form method="post">` would work and would land the browser on
   * `{"ok":true}` — the route answers JSON, not a redirect. `router.refresh()`
   * after the navigation is what actually clears the server-rendered session:
   * without it the panel stays painted behind the home page until something
   * else happens to re-render it.
   */
  async function signOut() {
    setLeaving(true);
    try {
      await fetch("/api/auth/signout", { method: "POST" });
    } catch {
      // Even a failed call should get them off the console. The cookie may
      // already be gone, and stranding somebody on a panel they meant to leave
      // is worse than one redundant sign-out next time.
    }
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-ink-300/40 bg-surface/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[110rem] items-center gap-4 px-4 sm:px-6">
        <Link href={panel === "admin" ? "/admin" : "/office"} className="shrink-0">
          <LogoLockup />
        </Link>

        <span
          className="hidden rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 sm:inline-block dark:text-brand-600"
          aria-label={t(`name.${panel}`)}
        >
          {t(`name.${panel}`)}
        </span>

        <div className="ms-auto flex items-center gap-1.5">
          <span className="hidden text-end sm:block">
            <span className="block text-xs leading-tight font-medium">{who}</span>
            {role ? <span className="block text-xs text-ink-600">{role}</span> : null}
          </span>

          <span className="mx-1 hidden h-6 w-px bg-ink-300/50 sm:block" aria-hidden />

          <LocaleSwitcher />
          <ThemeToggle />

          {/* Back to the customer-facing site, marked as leaving the console —
              staff use both and confusing them is how an announcement gets
              written on the wrong screen. */}
          <Link
            href="/"
            className="inline-flex size-9 items-center justify-center rounded-lg text-ink-600 transition-colors hover:bg-ink-300/20 hover:text-ink-900"
            aria-label={t("viewSite")}
            title={t("viewSite")}
          >
            <ArrowUpRight className="size-4.5" aria-hidden />
          </Link>

          <button
            type="button"
            onClick={signOut}
            disabled={leaving}
            className="inline-flex size-9 items-center justify-center rounded-lg text-ink-600 transition-colors hover:bg-down/10 hover:text-down disabled:opacity-50"
            aria-label={t("signOut")}
            title={t("signOut")}
          >
            <LogOut className="size-4.5" aria-hidden />
          </button>
        </div>
      </div>
    </header>
  );
}
