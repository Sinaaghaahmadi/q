import {
  Building2,
  FileClock,
  LayoutDashboard,
  Receipt,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import * as React from "react";
import { AdminNavLink } from "@/components/admin/admin-nav-link";
import { ImpersonationBanner } from "@/components/admin/impersonation-banner";
import { can, type Capability, type Seat } from "@/lib/auth/can";
import type { ExchangeOffice, Impersonation } from "@/lib/supabase/types";

const SECTIONS = [
  { href: "/admin", key: "dashboard", icon: LayoutDashboard, need: "platform.oversee" },
  { href: "/admin/exchanges", key: "exchanges", icon: Building2, need: "office.configure" },
  { href: "/admin/orders", key: "orders", icon: Receipt, need: "platform.oversee" },
  { href: "/admin/kyc", key: "kyc", icon: ShieldCheck, need: "kyc.review" },
  { href: "/admin/settings", key: "settings", icon: SlidersHorizontal, need: "platform.config" },
  { href: "/admin/audit", key: "audit", icon: FileClock, need: "platform.audit" },
] as const satisfies readonly {
  href: string;
  key: string;
  icon: typeof Building2;
  need: Capability;
}[];

/**
 * The frame every super-admin screen sits in (§4.3). The nav only lists what
 * this caller's seats reach, which keeps a support agent from staring at a
 * settings tab that would refuse them — and the impersonation banner sits
 * above everything, because §16.3 asks for it to be impossible to miss.
 */
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
  const visible = SECTIONS.filter((s) => can(seats, s.need));

  return (
    <div className="space-y-6 py-2">
      {impersonation ? (
        <ImpersonationBanner session={impersonation} office={office ?? null} />
      ) : null}

      <nav aria-label={t("navLabel")} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="bg-ink-50 flex min-w-max gap-1 rounded-2xl p-1">
          {visible.map((section) => (
            <li key={section.href}>
              <AdminNavLink
                href={section.href}
                icon={section.icon}
                label={t(`nav.${section.key}`)}
              />
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
    </div>
  );
}
