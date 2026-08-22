"use client";

import type { LucideIcon } from "lucide-react";
import * as React from "react";
import { Link, usePathname } from "@/i18n/navigation";

/** One nav pill. Client-side only so it can know which section it is in. */
export function AdminNavLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
}) {
  const pathname = usePathname();
  const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
        active ? "bg-surface text-brand-700 shadow-sm" : "text-ink-600 hover:text-ink-900"
      }`}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {label}
    </Link>
  );
}
