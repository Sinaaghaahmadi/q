import {
  Banknote,
  CircleDollarSign,
  Building2,
  ClipboardList,
  Coins,
  Landmark,
  LifeBuoy,
  MessageSquare,
  Percent,
  Settings,
  Users,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import * as React from "react";
import { versionLabel } from "@/lib/version";
import { PanelNavLink } from "@/components/layout/panel-nav-link";
import { OfficeLogo, officeLogoUrl } from "@/components/office/office-logo";
import type { ExchangeOffice } from "@/lib/supabase/types";

/**
 * The frame around the exchange-office panel.
 *
 * "کار امروز" is deliberately first and deliberately alone at the top: it is
 * the only screen an operator needs on an ordinary day, and everything else is
 * a settings-shaped thing they visit rarely. Icons carry every item because the
 * person reading this may not read comfortably, and the labels stay short
 * enough to be recognised rather than parsed.
 */
const SECTIONS = [
  { href: "/office", key: "today", icon: ClipboardList },
  { href: "/office/requests", key: "requests", icon: Coins },
  { href: "/office/coins", key: "coins", icon: CircleDollarSign },
  { href: "/office/tickets", key: "tickets", icon: LifeBuoy },
  { href: "/office/chat", key: "chat", icon: MessageSquare },
  { href: "/office/accounts", key: "accounts", icon: Landmark },
  { href: "/office/settlement", key: "settlement", icon: Banknote },
  { href: "/office/liquidity", key: "liquidity", icon: Coins },
  { href: "/office/rates", key: "rates", icon: Percent },
  { href: "/office/customers", key: "customers", icon: Users },
  { href: "/office/team", key: "team", icon: Users },
  { href: "/office/reports", key: "reports", icon: ClipboardList },
  { href: "/office/settings", key: "settings", icon: Settings },
] as const;

export async function OfficeShell({
  office,
  locale,
  title,
  description,
  actions,
  children,
}: {
  office: Pick<
    ExchangeOffice,
    "id" | "legal_name_fa" | "legal_name_en" | "display_name" | "logo_path" | "status"
  > | null;
  locale: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = await getTranslations("officePanel");
  // The display name is what the office chose to be called; the legal names
  // are for contracts. A panel header is not a contract.
  const name = office
    ? (office.display_name ?? (locale === "fa" ? office.legal_name_fa : office.legal_name_en))
    : null;

  return (
    <div className="space-y-5 py-2">
      <div className="flex flex-wrap items-center gap-3">
        {office ? (
          <OfficeLogo
            name={name}
            logoUrl={officeLogoUrl(office.logo_path)}
            officeId={office.id}
            size={40}
          />
        ) : (
          <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50">
            <Building2 className="size-5 text-brand-600" aria-hidden />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{name ?? t("unknownOffice")}</p>
          {office ? <p className="text-xs text-ink-600">{t(`status.${office.status}`)}</p> : null}
        </div>
      </div>

      <nav aria-label={t("navLabel")} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-1 rounded-2xl bg-ink-300/25 p-1">
          {SECTIONS.map((section) => (
            <li key={section.href}>
              <PanelNavLink
                href={section.href}
                label={t(`nav.${section.key}`)}
                hint={t(`hint.${section.key}`)}
                hintLabel={t("hintLabel")}
                root="/office"
              >
                <section.icon className="size-4 shrink-0" aria-hidden />
              </PanelNavLink>
            </li>
          ))}
        </ul>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description ? <p className="mt-1 text-sm text-ink-600">{description}</p> : null}
        </div>
        {actions}
      </header>

      {children}

      {/* Which build this panel is. The first question support asks and the
          last thing a console usually tells you. */}
      <p className="pt-2 text-end font-mono text-xs text-ink-600/70" dir="ltr">
        {versionLabel()}
      </p>
    </div>
  );
}
