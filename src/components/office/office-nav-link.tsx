"use client";

import * as React from "react";
import { Link, usePathname } from "@/i18n/navigation";

/**
 * The icon arrives as an already-rendered element in `children`, never as a
 * component in a prop: a lucide icon is a function, and a function cannot cross
 * the server/client boundary — React refuses to serialize it and the whole page
 * 500s. Elements serialize fine, so the server renders the icon and this only
 * decides whether the row looks active.
 */
export function OfficeNavLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = href === "/office" ? pathname === "/office" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
        active ? "bg-surface text-brand-700 shadow-sm" : "text-ink-600 hover:text-ink-900"
      }`}
    >
      {children}
      {label}
    </Link>
  );
}
