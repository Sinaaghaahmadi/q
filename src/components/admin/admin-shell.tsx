import {
  Building2,
  FileClock,
  FileText,
  Handshake,
  LayoutDashboard,
  LifeBuoy,
  Percent,
  Receipt,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  TicketCheck,
  Users,
  Wallet,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import * as React from "react";
import { PanelNavLink } from "@/components/layout/panel-nav-link";
import { ImpersonationBanner } from "@/components/admin/impersonation-banner";
import { can, type Capability, type Seat } from "@/lib/auth/can";
import type { ExchangeOffice, Impersonation } from "@/lib/supabase/types";

/**
 * The super-admin console's frame (§4.3).
 *
 * Grouped rather than flat: fourteen destinations in one strip is a list to
 * search, four groups of three or four is a place to navigate. The groups match
 * how the questions arrive — something is wrong with an *order*, with a
 * *person*, with the *money*, with the *platform* — not how the tables are laid
 * out.
 *
 * The nav only renders what the caller's seats reach, so a support agent never
 * sees a settings link that would refuse them. That is convenience, not
 * security: `can()` mirrors §5 and RLS is what actually decides.
 */
const GROUPS = [
  {
    key: "overview",
    items: [{ href: "/admin", key: "dashboard", icon: LayoutDashboard, need: "platform.oversee" }],
  },
  {
    key: "operations",
    items: [
      { href: "/admin/orders", key: "orders", icon: Receipt, need: "platform.oversee" },
      { href: "/admin/exchanges", key: "exchanges", icon: Building2, need: "office.configure" },
      { href: "/admin/p2p", key: "p2p", icon: Handshake, need: "platform.oversee" },
      { href: "/admin/support", key: "support", icon: LifeBuoy, need: "platform.oversee" },
      { href: "/admin/tickets", key: "tickets", icon: TicketCheck, need: "platform.oversee" },
    ],
  },
  {
    key: "people",
    items: [
      { href: "/admin/users", key: "users", icon: Users, need: "platform.oversee" },
      { href: "/admin/kyc", key: "kyc", icon: ShieldCheck, need: "kyc.review" },
      { href: "/admin/compliance", key: "compliance", icon: ScrollText, need: "platform.audit" },
    ],
  },
  {
    key: "money",
    items: [
      { href: "/admin/finance", key: "finance", icon: Wallet, need: "platform.oversee" },
      { href: "/admin/rates", key: "rates", icon: Percent, need: "platform.config" },
    ],
  },
  {
    key: "platform",
    items: [
      { href: "/admin/content", key: "content", icon: FileText, need: "platform.config" },
      {
        href: "/admin/settings",
        key: "settings",
        icon: SlidersHorizontal,
        need: "platform.config",
      },
      { href: "/admin/audit", key: "audit", icon: FileClock, need: "platform.audit" },
    ],
  },
] as const satisfies readonly {
  key: string;
  items: readonly { href: string; key: string; icon: typeof Building2; need: Capability }[];
}[];

export async function AdminShell({
  seats,
  impersonation,
  office,
  title,
  description,
  actions,
  children,
}: {
  seats: readonly Seat[];
  impersonation?: Impersonation | null;
  office?: Pick<ExchangeOffice, "legal_name_fa" | "legal_name_en"> | null;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = await getTranslations("admin");

  const groups = GROUPS.map((group) => ({
    key: group.key,
    items: group.items.filter((item) => can(seats, item.need)),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="py-2">
      {impersonation ? (
        <div className="mb-5">
          <ImpersonationBanner session={impersonation} office={office ?? null} />
        </div>
      ) : null}

      <div className="lg:grid lg:grid-cols-[15rem_1fr] lg:gap-8">
        <nav aria-label={t("navLabel")} className="mb-5 lg:mb-0">
          {/* Below lg the groups flatten into one scrolling strip: a sidebar
              that eats half a phone screen is worse than no grouping at all. */}
          <div className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
            <ul className="flex min-w-max gap-1 rounded-2xl bg-ink-300/25 p-1 lg:min-w-0 lg:flex-col lg:gap-4 lg:bg-transparent lg:p-0">
              {groups.map((group) => (
                <li key={group.key} className="lg:space-y-1">
                  <p className="hidden px-3 text-xs font-semibold tracking-wide text-ink-600 uppercase lg:block">
                    {t(`group.${group.key}`)}
                  </p>
                  <ul className="flex gap-1 lg:flex-col">
                    {group.items.map((item) => (
                      <li key={item.href}>
                        <PanelNavLink
                          href={item.href}
                          label={t(`nav.${item.key}`)}
                          hint={t(`hint.${item.key}`)}
                          hintLabel={t("hintLabel")}
                          root="/admin"
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
        </nav>

        <div className="min-w-0 space-y-6">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
              {description ? <p className="mt-1 text-sm text-ink-600">{description}</p> : null}
            </div>
            {actions}
          </header>

          {children}
        </div>
      </div>
    </div>
  );
}
