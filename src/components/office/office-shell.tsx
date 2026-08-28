import {
  Banknote,
  Building2,
  CircleDollarSign,
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
import { PanelCredit } from "@/components/layout/panel-credit";
import { PanelNavLink } from "@/components/layout/panel-nav-link";
import { PanelTopBar } from "@/components/layout/panel-top-bar";
import { OfficeLogo, officeLogoUrl } from "@/components/office/office-logo";
import { officeScopes, type Seat } from "@/lib/auth/can";
import { getSessionProfile } from "@/lib/supabase/server";
import type { ExchangeOffice } from "@/lib/supabase/types";

/**
 * The frame around the exchange-office panel.
 *
 * It wears the same frame as the super-admin console now, and that is the
 * point: both are consoles for moving other people's money, staff hold seats in
 * both, and until now one of them looked like the shop's marketing site with a
 * strip of thirteen tabs across the top. Same top bar, same grouped rail, same
 * glass sections, same `i` beside everything — so a person who has learned one
 * has learned the other, and "which panel am I in" is answered by a chip rather
 * than by remembering.
 *
 * "کار امروز" is still deliberately first and alone in its own group: it is the
 * only screen an operator needs on an ordinary day, and everything else is a
 * settings-shaped thing they visit rarely. The other twelve are grouped by the
 * question that brings somebody to them — work waiting, money, the office
 * itself — rather than by the order the tables were written in. Icons carry
 * every item because the person reading this may not read comfortably.
 */
const GROUPS = [
  {
    key: "today",
    items: [{ href: "/office", key: "today", icon: ClipboardList }],
  },
  {
    key: "work",
    items: [
      { href: "/office/requests", key: "requests", icon: Coins },
      { href: "/office/coins", key: "coins", icon: CircleDollarSign },
      { href: "/office/tickets", key: "tickets", icon: LifeBuoy },
      { href: "/office/chat", key: "chat", icon: MessageSquare },
    ],
  },
  {
    key: "money",
    items: [
      { href: "/office/accounts", key: "accounts", icon: Landmark },
      { href: "/office/settlement", key: "settlement", icon: Banknote },
      { href: "/office/liquidity", key: "liquidity", icon: Coins },
      { href: "/office/rates", key: "rates", icon: Percent },
    ],
  },
  {
    key: "office",
    items: [
      { href: "/office/customers", key: "customers", icon: Users },
      { href: "/office/team", key: "team", icon: Users },
      { href: "/office/reports", key: "reports", icon: ClipboardList },
      { href: "/office/settings", key: "settings", icon: Settings },
    ],
  },
] as const satisfies readonly {
  key: string;
  items: readonly { href: string; key: string; icon: typeof Building2 }[];
}[];

/**
 * Which office seat to print in the top bar.
 *
 * Strongest first, for the same reason the admin console ranks its own: an
 * owner who also holds an operator seat is here as an owner, and saying
 * "کارشناس" would understate what a mistaken click can do.
 */
const ROLE_RANK = ["office_owner", "office_finance", "office_operator", "office_viewer"] as const;

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
  const tTeam = await getTranslations("officePanel.team");

  // The display name is what the office chose to be called; the legal names
  // are for contracts. A panel header is not a contract.
  const name = office
    ? (office.display_name ?? (locale === "fa" ? office.legal_name_fa : office.legal_name_en))
    : null;

  /*
   * Who is signed in, for the top bar.
   *
   * Read here rather than threaded through thirteen call sites, every one of
   * which would have had to be edited to add a name to a header. The seat is
   * narrowed to *this* office where we know which office that is: somebody who
   * owns one branch and merely views another should be told which of the two
   * they are looking at.
   */
  const session = await getSessionProfile();
  const seats = (session?.memberships ?? []) as Seat[];
  const here = office?.id ?? officeScopes(seats)[0];
  const strongest = ROLE_RANK.find((role) =>
    seats.some(
      (seat) =>
        seat.scope_type === "office" &&
        seat.role === role &&
        (here === undefined || seat.scope_id === here),
    ),
  );
  const who =
    session?.profile?.full_name_fa || session?.profile?.full_name_latin || (name ?? t("nav.today"));

  return (
    <div data-panel className="min-h-dvh bg-canvas">
      <PanelTopBar
        panel="office"
        who={who}
        role={strongest ? tTeam(`role.${strongest}`) : undefined}
      />

      <div className="mx-auto max-w-[110rem] px-4 pb-16 sm:px-6 lg:grid lg:grid-cols-[15rem_1fr] lg:gap-8">
        <nav aria-label={t("navLabel")} className="py-4 lg:panel-rail lg:py-6">
          {/* Which office this is, at the top of its own navigation. On the
              admin console this space holds nothing, because there is only one
              platform; here it is the first thing to check when a person holds
              seats at two branches. */}
          <div className="mb-3 flex items-center gap-2.5 rounded-xl px-1 lg:mb-4">
            {office ? (
              <OfficeLogo
                name={name}
                logoUrl={officeLogoUrl(office.logo_path)}
                officeId={office.id}
                size={36}
              />
            ) : (
              <span className="flex size-9 items-center justify-center rounded-xl bg-brand-50">
                <Building2 className="size-4.5 text-brand-600" aria-hidden />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">
                {name ?? t("unknownOffice")}
              </span>
              {office ? (
                <span className="block text-xs text-ink-600">{t(`status.${office.status}`)}</span>
              ) : null}
            </span>
          </div>

          {/* Below lg the groups flatten into one scrolling strip: a sidebar
              that eats half a phone screen is worse than no grouping at all. */}
          <div className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
            <ul className="flex min-w-max gap-1 rounded-2xl bg-ink-300/25 p-1 lg:min-w-0 lg:flex-col lg:gap-5 lg:bg-transparent lg:p-0">
              {GROUPS.map((group) => (
                <li key={group.key} className="lg:space-y-1">
                  <p className="hidden px-3 pb-1 text-[0.6875rem] font-semibold tracking-[0.08em] text-ink-600/80 uppercase lg:block">
                    {t(`group.${group.key}`)}
                  </p>
                  <ul className="flex gap-1 lg:flex-col lg:gap-0.5">
                    {group.items.map((item) => (
                      <li key={item.href}>
                        <PanelNavLink
                          href={item.href}
                          label={t(`nav.${item.key}`)}
                          hint={t(`hint.${item.key}`)}
                          hintLabel={t("hintLabel")}
                          root="/office"
                          compact
                        >
                          <item.icon className="size-4 shrink-0" aria-hidden />
                        </PanelNavLink>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>

          {/* Which build this panel is, and who wrote it. The first question
              support asks and the last thing a console usually tells you. On a
              phone the rail is a scrolling strip with no room underneath, so
              the same two lines close the page instead. */}
          <PanelCredit className="mt-6 hidden lg:block" builtBy={t("builtBy")} />
        </nav>

        <div className="min-w-0 space-y-6 py-2 lg:py-6">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
              {description ? (
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-600">{description}</p>
              ) : null}
            </div>
            {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
          </header>

          {children}

          <PanelCredit className="lg:hidden" builtBy={t("builtBy")} />
        </div>
      </div>
    </div>
  );
}
