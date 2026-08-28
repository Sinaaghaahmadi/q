import {
  Banknote,
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
import { PanelCredit } from "@/components/layout/panel-credit";
import { PanelNavLink } from "@/components/layout/panel-nav-link";
import { PanelTopBar } from "@/components/layout/panel-top-bar";
import { ImpersonationBanner } from "@/components/admin/impersonation-banner";
import { can, type Capability, type Seat } from "@/lib/auth/can";
import { getSessionProfile } from "@/lib/supabase/server";
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
      {
        href: "/admin/settlement",
        key: "settlement",
        icon: Banknote,
        need: "office.configure",
      },
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

/**
 * Which platform seat to print in the top bar.
 *
 * Ordered deliberately: somebody holding both superadmin and support is here
 * as a superadmin, and saying "پشتیبانی" would understate what a mistaken
 * click can do. It is the seat, not the sidebar group they happen to be in —
 * "پلتفرم" told an administrator the name of a menu heading.
 */
const ROLE_RANK = [
  "platform_superadmin",
  "platform_admin",
  "platform_compliance",
  "platform_support",
] as const;

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

  /*
   * Who is signed in, read here rather than passed in.
   *
   * It used to be a prop, and sixteen of the seventeen admin routes did not
   * pass it — so every page except the dashboard printed the raw fallback key
   * where a person's name belongs. A frame that needs a fact should fetch the
   * fact; `getSessionProfile` is deduplicated per request, so this costs
   * nothing on top of the gate the page already ran.
   */
  const session = await getSessionProfile();
  const strongest = ROLE_RANK.find((role) =>
    seats.some((seat) => seat.scope_type === "platform" && seat.role === role),
  );
  const who = {
    name: session?.profile?.full_name_fa || session?.profile?.full_name_latin || t("staffFallback"),
    role: strongest ? t(`security.role.${strongest}`) : undefined,
  };

  const groups = GROUPS.map((group) => ({
    key: group.key,
    items: group.items.filter((item) => can(seats, item.need)),
  })).filter((group) => group.items.length > 0);

  return (
    <div data-panel className="min-h-dvh bg-canvas">
      <PanelTopBar panel="admin" who={who.name} role={who.role} />

      {impersonation ? (
        <div className="mx-auto max-w-[110rem] px-4 pt-4 sm:px-6">
          <ImpersonationBanner session={impersonation} office={office ?? null} />
        </div>
      ) : null}

      <div className="mx-auto max-w-[110rem] px-4 pb-16 sm:px-6 lg:grid lg:grid-cols-[15rem_1fr] lg:gap-8">
        <nav aria-label={t("navLabel")} className="py-4 lg:panel-rail lg:py-6">
          {/* Below lg the groups flatten into one scrolling strip: a sidebar
              that eats half a phone screen is worse than no grouping at all. */}
          <div className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
            <ul className="flex min-w-max gap-1 rounded-2xl bg-ink-300/25 p-1 lg:min-w-0 lg:flex-col lg:gap-5 lg:bg-transparent lg:p-0">
              {groups.map((group) => (
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
