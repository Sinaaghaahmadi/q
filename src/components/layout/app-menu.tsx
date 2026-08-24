"use client";

import {
  ArrowLeftRight,
  BadgeCheck,
  Bell,
  Building2,
  ChartNoAxesCombined,
  ChevronLeft,
  CircleUser,
  Coins,
  FileText,
  Handshake,
  Info,
  LifeBuoy,
  type LucideIcon,
  Mail,
  Map,
  Palette,
  Receipt,
  ScrollText,
  Shield,
  Sparkles,
  Wallet,
} from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Sheet } from "@/components/ui/sheet";
import { LEGAL_SLUGS } from "@/content/legal";
import { Link, usePathname } from "@/i18n/navigation";
import { versionLabel } from "@/lib/version";
import { cn } from "@/lib/utils";

/**
 * Everything that used to be in the footer, in one place you can actually
 * reach.
 *
 * The old arrangement put a four-column site footer under every screen. On a
 * desktop that is a convention; in a PWA it is fifteen links a thumb has to
 * scroll past to reach the end of a page, repeated on every page, below a
 * bottom tab bar that already covers navigation. The links themselves were
 * fine — the place was wrong.
 *
 * So they moved here: one sheet, opened from the tab bar and from the header,
 * grouped the way somebody looks for things rather than the way a footer grid
 * happens to fit. Services first, because that is what most taps are for;
 * account and staff panels where they belong; the explanatory pages and the
 * legal set below; language, theme and the version last. The footer is now a
 * single line.
 */

interface MenuState {
  open: boolean;
  setOpen: (open: boolean) => void;
  signedIn: boolean;
  officeMember: boolean;
  platformStaff: boolean;
}

const MenuContext = React.createContext<MenuState | null>(null);

export function useAppMenu(): MenuState {
  const value = React.useContext(MenuContext);
  if (!value) throw new Error("useAppMenu must be used inside <MenuProvider>");
  return value;
}

export function MenuProvider({
  children,
  signedIn = false,
  officeMember = false,
  platformStaff = false,
}: {
  children: React.ReactNode;
  signedIn?: boolean;
  officeMember?: boolean;
  platformStaff?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  // Navigating closes it. Without this the sheet stays over the page it just
  // sent you to, which reads as a tap that did nothing.
  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const value = React.useMemo(
    () => ({ open, setOpen, signedIn, officeMember, platformStaff }),
    [open, signedIn, officeMember, platformStaff],
  );

  return <MenuContext.Provider value={value}>{children}</MenuContext.Provider>;
}

interface Entry {
  href: string;
  label: string;
  icon: LucideIcon;
  hint?: string;
}

function Row({ entry }: { entry: Entry }) {
  const pathname = usePathname();
  const active = pathname === entry.href || pathname.startsWith(`${entry.href}/`);
  const { icon: Icon } = entry;
  return (
    <li>
      <Link
        href={entry.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
          active ? "bg-brand-50 text-brand-700 dark:text-brand-600" : "hover:bg-ink-300/20",
        )}
      >
        <Icon className="size-4.5 shrink-0 text-ink-600" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{entry.label}</span>
          {entry.hint ? (
            <span className="block truncate text-xs text-ink-600">{entry.hint}</span>
          ) : null}
        </span>
        <ChevronLeft className="size-4 shrink-0 text-ink-300 ltr:rotate-180" aria-hidden />
      </Link>
    </li>
  );
}

function Group({ title, entries }: { title: string; entries: Entry[] }) {
  if (entries.length === 0) return null;
  return (
    <section className="pt-4 first:pt-0">
      <h3 className="px-3 pb-1 text-xs font-semibold tracking-wide text-ink-600">{title}</h3>
      <ul className="-mx-1">
        {entries.map((entry) => (
          <Row key={entry.href} entry={entry} />
        ))}
      </ul>
    </section>
  );
}

export function AppMenu() {
  const { open, setOpen, signedIn, officeMember, platformStaff } = useAppMenu();
  const t = useTranslations("nav");
  const tMenu = useTranslations("menu");
  const tLegal = useTranslations("legal.titles");
  const tFooter = useTranslations("footer");

  const services: Entry[] = [
    { href: "/rates", label: t("rates"), icon: ChartNoAxesCombined, hint: tMenu("hint.rates") },
    { href: "/transfer/new", label: t("transfer"), icon: ArrowLeftRight, hint: tMenu("hint.transfer") },
    { href: "/coins", label: t("coins"), icon: Coins, hint: tMenu("hint.coins") },
    { href: "/p2p", label: t("p2p"), icon: Handshake, hint: tMenu("hint.p2p") },
    { href: "/orders", label: t("orders"), icon: Receipt, hint: tMenu("hint.orders") },
    { href: "/t", label: tMenu("track"), icon: Map, hint: tMenu("hint.track") },
  ];

  const account: Entry[] = signedIn
    ? [
        { href: "/profile", label: t("profile"), icon: CircleUser, hint: tMenu("hint.profile") },
        { href: "/accounts", label: t("accounts"), icon: Wallet, hint: tMenu("hint.accounts") },
        { href: "/verify", label: t("verify"), icon: BadgeCheck, hint: tMenu("hint.verify") },
        { href: "/rates?alerts=1", label: tMenu("alerts"), icon: Bell, hint: tMenu("hint.alerts") },
      ]
    : [{ href: "/signin", label: t("signin"), icon: CircleUser, hint: tMenu("hint.signin") }];

  const staff: Entry[] = [
    ...(officeMember
      ? [{ href: "/office", label: t("office"), icon: Building2, hint: tMenu("hint.office") }]
      : []),
    ...(platformStaff
      ? [
          { href: "/admin", label: t("admin"), icon: Shield, hint: tMenu("hint.admin") },
          // The component reference. Useful to whoever is building on this and
          // meaningless to a customer, so it appears with the other staff-only
          // entries rather than in a public footer.
          { href: "/design", label: tFooter("designSystem"), icon: Palette },
        ]
      : []),
  ];

  const company: Entry[] = [
    { href: "/how", label: t("how"), icon: Sparkles },
    { href: "/why", label: t("why"), icon: Info },
    { href: "/about", label: t("about"), icon: Building2 },
    { href: "/contact", label: t("contact"), icon: Mail },
    { href: "/support", label: t("support"), icon: LifeBuoy },
  ];

  const legal: Entry[] = LEGAL_SLUGS.map((slug) => ({
    href: `/legal/${slug}`,
    label: tLegal(slug),
    icon: slug === "fees" ? ScrollText : FileText,
  }));

  return (
    <Sheet
      open={open}
      onClose={() => setOpen(false)}
      title={tMenu("title")}
      className="sm:max-w-md"
      footer={
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-ink-600">{tMenu("appearance")}</span>
            <div className="flex items-center gap-1.5">
              <LocaleSwitcher />
              <ThemeToggle />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-300/40 pt-3 text-xs text-ink-600">
            <span>{tFooter("copyright")}</span>
            {/* The version, in the one place somebody asked to see support
                details would look for it. Latin digits: it is an identifier. */}
            <span className="font-mono" dir="ltr">
              {tMenu("version", { version: versionLabel() })}
            </span>
          </div>
        </div>
      }
    >
      <div className="pb-2">
        <p className="px-3 pb-2 text-xs leading-relaxed text-ink-600">{tFooter("tagline")}</p>
        <Group title={tMenu("group.services")} entries={services} />
        <Group title={tMenu("group.account")} entries={account} />
        <Group title={tMenu("group.staff")} entries={staff} />
        <Group title={tMenu("group.company")} entries={company} />
        <Group title={tMenu("group.legal")} entries={legal} />
        <p className="px-3 pt-5 text-xs leading-relaxed text-ink-600/80">{tFooter("compliance")}</p>
      </div>
    </Sheet>
  );
}
