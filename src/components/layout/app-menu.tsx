"use client";

import {
  Building2,
  Coins,
  FileText,
  Handshake,
  Info,
  LifeBuoy,
  Mail,
  Map,
  Palette,
  ScrollText,
  Shield,
  Sparkles,
} from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { NavGroup, NavRow } from "@/components/layout/nav-list";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Sheet } from "@/components/ui/sheet";
import { LEGAL_SLUGS } from "@/content/legal";
import { usePathname } from "@/i18n/navigation";
import { versionLabel } from "@/lib/version";

/**
 * What the tab bar does not already carry.
 *
 * This started as the old site footer moved somewhere reachable, and it kept
 * the footer's instinct: list everything. So the sheet repeated the four
 * destinations already sitting under the reader's thumb — rates, transfer,
 * orders, profile — opened with a paragraph of marketing copy, and pushed the
 * things that exist *only* here below the fold of a panel that stops at 88% of
 * the screen.
 *
 * It carries the remainder now, and nothing else: the two services that have no
 * tab, the way to track an order without signing in, the staff panels for the
 * people who hold a seat, the pages about the company, and the legal set. Four
 * short groups instead of six long ones, each an inset card the way a phone
 * draws a settings screen.
 *
 * Account destinations — saved accounts, identity, price alerts — left too.
 * They belong on the profile page, which is now a tab of its own, rather than
 * in a navigation sheet.
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
  icon: React.ReactNode;
  hint?: string;
  /** Extra classes on the row — used to hide a desktop-header duplicate. */
  className?: string;
}

function Group({ title, entries }: { title: string; entries: Entry[] }) {
  if (entries.length === 0) return null;
  return (
    <NavGroup title={title}>
      {entries.map((entry) => (
        <NavRow
          key={entry.href}
          href={entry.href}
          label={entry.label}
          hint={entry.hint}
          icon={entry.icon}
        />
      ))}
    </NavGroup>
  );
}

export function AppMenu() {
  const { open, setOpen, signedIn, officeMember, platformStaff } = useAppMenu();
  const t = useTranslations("nav");
  const tMenu = useTranslations("menu");
  const tLegal = useTranslations("legal.titles");
  const tFooter = useTranslations("footer");

  /*
   * Deliberately not here: rates, transfer, orders and profile. All four are
   * one thumb-reach away on the tab bar, and a menu that repeats the tab bar
   * teaches people that the menu is where you go when you cannot find the tab.
   */
  const services: Entry[] = [
    {
      href: "/coins",
      label: t("coins"),
      icon: <Coins className="size-4.5" />,
      hint: tMenu("hint.coins"),
    },
    {
      href: "/p2p",
      label: t("p2p"),
      icon: <Handshake className="size-4.5" />,
      hint: tMenu("hint.p2p"),
    },
    {
      href: "/t",
      label: tMenu("track"),
      icon: <Map className="size-4.5" />,
      hint: tMenu("hint.track"),
    },
  ];

  const staff: Entry[] = [
    ...(officeMember
      ? [
          {
            href: "/office",
            label: t("office"),
            icon: <Building2 className="size-4.5" />,
            hint: tMenu("hint.office"),
          },
        ]
      : []),
    ...(platformStaff
      ? [
          {
            href: "/admin",
            label: t("admin"),
            icon: <Shield className="size-4.5" />,
            hint: tMenu("hint.admin"),
          },
          // The component reference. Useful to whoever is building on this and
          // meaningless to a customer, so it appears with the other staff-only
          // entries rather than in a public footer.
          {
            href: "/design",
            label: tFooter("designSystem"),
            icon: <Palette className="size-4.5" />,
          },
        ]
      : []),
  ];

  const company: Entry[] = [
    { href: "/how", label: t("how"), icon: <Sparkles className="size-4.5" /> },
    { href: "/why", label: t("why"), icon: <Info className="size-4.5" /> },
    { href: "/about", label: t("about"), icon: <Building2 className="size-4.5" /> },
    { href: "/contact", label: t("contact"), icon: <Mail className="size-4.5" /> },
    { href: "/support", label: t("support"), icon: <LifeBuoy className="size-4.5" /> },
  ];

  const legal: Entry[] = LEGAL_SLUGS.map((slug) => ({
    href: `/legal/${slug}`,
    label: tLegal(slug),
    icon: slug === "fees" ? <ScrollText className="size-4.5" /> : <FileText className="size-4.5" />,
  }));

  return (
    <Sheet
      open={open}
      onClose={() => setOpen(false)}
      title={tMenu("more")}
      className="sm:max-w-md"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <LocaleSwitcher />
            <ThemeToggle />
          </div>
          {/* The version, where somebody asked for support details would look
              for it. Latin digits: it is an identifier, not a quantity. */}
          <span className="font-mono text-xs text-ink-600" dir="ltr">
            {tMenu("version", { version: versionLabel() })}
          </span>
        </div>
      }
    >
      <div className="space-y-4 pb-2">
        <Group title={tMenu("group.services")} entries={services} />
        <Group title={tMenu("group.staff")} entries={staff} />
        <Group title={tMenu("group.company")} entries={company} />
        <Group title={tMenu("group.legal")} entries={legal} />
        {/* One line, not the paragraph that used to open this sheet: whoever
            pulled up a navigation menu is looking for a destination. */}
        {signedIn ? null : (
          <p className="px-1 pt-1 text-xs leading-relaxed text-ink-600/80">
            {tMenu("signedOutNote")}
          </p>
        )}
      </div>
    </Sheet>
  );
}
