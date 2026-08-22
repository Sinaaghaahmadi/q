import { getTranslations } from "next-intl/server";
import * as React from "react";
import { Link } from "@/i18n/navigation";
import { LEGAL_SLUGS } from "@/content/legal";

export async function Footer() {
  const t = await getTranslations("footer");
  const tLegal = await getTranslations("legal.titles");
  const nav = await getTranslations("nav");

  return (
    <footer className="mt-16 border-t border-ink-300/40 bg-surface pb-28 md:pb-10">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div className="space-y-3 md:col-span-2">
          <p className="text-lg font-bold">{t("brand")}</p>
          <p className="max-w-md text-sm leading-relaxed text-ink-600">{t("tagline")}</p>
          <p className="max-w-md text-xs leading-relaxed text-ink-600/80">{t("compliance")}</p>
        </div>

        <nav aria-label={t("product")} className="space-y-3">
          <p className="text-sm font-semibold">{t("product")}</p>
          <ul className="space-y-2 text-sm text-ink-600">
            <li>
              <Link className="hover:text-ink-900" href="/rates">
                {nav("rates")}
              </Link>
            </li>
            <li>
              <Link className="hover:text-ink-900" href="/transfer/new">
                {nav("startTransfer")}
              </Link>
            </li>
            <li>
              <Link className="hover:text-ink-900" href="/orders">
                {nav("orders")}
              </Link>
            </li>
            <li>
              <Link className="hover:text-ink-900" href="/support">
                {nav("support")}
              </Link>
            </li>
            <li>
              <Link className="hover:text-ink-900" href="/design">
                {t("designSystem")}
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label={t("legal")} className="space-y-3">
          <p className="text-sm font-semibold">{t("legal")}</p>
          <ul className="space-y-2 text-sm text-ink-600">
            {LEGAL_SLUGS.map((slug) => (
              <li key={slug}>
                <Link className="hover:text-ink-900" href={`/legal/${slug}`}>
                  {tLegal(slug)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 border-t border-ink-300/40 px-4 py-5 text-xs text-ink-600 sm:px-6">
        <p>{t("copyright")}</p>
        <p className="num">{t("buildTag")}</p>
      </div>
    </footer>
  );
}
