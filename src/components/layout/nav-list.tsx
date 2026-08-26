"use client";

import { ChevronLeft } from "lucide-react";
import * as React from "react";
import { AppTile, type TileHue } from "@/components/brand/app-tile";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * The grouped list a phone uses for navigation, and the shape people already
 * know from every settings screen they have ever opened.
 *
 * The menu used to be flat rows on the sheet's own background, which is what a
 * web page does and not what an app does: nothing said where one group ended
 * and the next began except a heading floating in space, and a row was a line
 * of text rather than a thing to press. Here each group is one inset card,
 * hairlines separate the rows inside it, the icon sits in a tinted square, and
 * the chevron points the way the reader travels.
 *
 * The icon sits on an `AppTile` — the lit, domed square the 3D coin taught the
 * rest of the product. A flat stroke in a pale square is legible only once you
 * have read the label beside it, which is the opposite of what an icon in a
 * menu is for.
 *
 * Icons arrive rendered (`icon={<Coins className="size-4.5" />}`) rather than
 * as components. Both callers happen to be client components today, but the
 * moment one is not, a lucide icon in a prop 500s the page — this repo has
 * three separate notes about that, all written after the fact.
 */
export function NavGroup({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-1.5", className)}>
      {title ? (
        <h3 className="px-1 text-[0.6875rem] font-semibold tracking-[0.06em] text-ink-600/80 uppercase">
          {title}
        </h3>
      ) : null}
      <ul className="divide-y divide-ink-300/35 overflow-hidden rounded-2xl border border-ink-300/50 bg-surface">
        {children}
      </ul>
    </section>
  );
}

export function NavRow({
  href,
  label,
  hint,
  icon,
  hue = "brand",
  onClick,
  className,
}: {
  href: string;
  label: string;
  hint?: string;
  /** Already rendered. */
  icon: React.ReactNode;
  /** Which of the seven tile hues carries this row's meaning. */
  hue?: TileHue;
  onClick?: () => void;
  /** On the `<li>`, so a row can hide at a width where it is a duplicate. */
  className?: string;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <li className={className}>
      <Link
        href={href}
        onClick={onClick}
        aria-current={active ? "page" : undefined}
        className={cn(
          "pressable flex items-center gap-3 px-3.5 py-3 transition-colors",
          active ? "bg-brand-50/70" : "hover:bg-ink-300/12",
        )}
      >
        <AppTile hue={hue}>{icon}</AppTile>
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block truncate text-sm font-medium",
              active && "text-brand-700 dark:text-brand-600",
            )}
          >
            {label}
          </span>
          {hint ? <span className="block truncate text-xs text-ink-600">{hint}</span> : null}
        </span>
        <ChevronLeft className="size-4 shrink-0 text-ink-300 ltr:rotate-180" aria-hidden />
      </Link>
    </li>
  );
}
