"use client";

import { Info } from "lucide-react";
import * as React from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * One nav row for either staff panel, with an explanation attached.
 *
 * The office panel is used by people who did not choose this software and may
 * open it a few times a week; the admin console has thirteen destinations whose
 * names ("انطباق", "دفتر کل") mean nothing until you have been inside them. A
 * label alone assumes the reader already knows the product. So every row
 * carries an `i` that says, in one sentence, what is behind it.
 *
 * The hint is a sibling of the link, never inside it: a button nested in an
 * anchor is invalid HTML, and browsers resolve it by making one of the two
 * unclickable — usually the one you wanted. It toggles inline text rather than
 * a floating popover because a popover needs hover, and hover does not exist on
 * the phone an operator actually holds.
 *
 * The icon arrives as a rendered element in `children`, never as a component in
 * a prop: a lucide icon is a function, functions do not cross the server/client
 * boundary, and passing one 500s the page.
 */
export function PanelNavLink({
  href,
  label,
  hint,
  hintLabel,
  root,
  compact = false,
  children,
}: {
  href: string;
  label: string;
  /** One sentence on what this section is for. */
  hint: string;
  /** Accessible name for the `i` button, e.g. "About this section". */
  hintLabel: string;
  /** The panel's index route, which must match exactly rather than by prefix. */
  root: string;
  /** Tighter padding for the admin console's denser sidebar. */
  compact?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = href === root ? pathname === root : pathname.startsWith(href);
  const [open, setOpen] = React.useState(false);
  const hintId = React.useId();

  return (
    <div className="lg:w-full">
      <div className="flex items-center gap-1">
        <Link
          href={href}
          aria-current={active ? "page" : undefined}
          className={cn(
            "pressable flex min-w-0 flex-1 items-center gap-2 rounded-xl text-sm font-medium",
            compact ? "px-3 py-2" : "px-3.5 py-2.5",
            /* The active row used to be `bg-surface` — white on a white
               sidebar, which is no marking at all on desktop. It carries the
               brand tint and a leading rule now, so where you are is legible
               from the corner of the eye. */
            active
              ? "bg-brand-50 font-semibold text-brand-700 shadow-[inset_2px_0_0_var(--brand-600)] rtl:shadow-[inset_-2px_0_0_var(--brand-600)] dark:text-brand-600"
              : "text-ink-600 hover:bg-ink-300/20 hover:text-ink-900",
          )}
        >
          {children}
          <span className="truncate">{label}</span>
        </Link>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={hintId}
          aria-label={`${hintLabel} — ${label}`}
          className={cn(
            /* Quiet by default. Fifteen of these at full contrast turned a
               sidebar into a column of icons; they are still always present
               and always reachable — a hover-only control does not exist on
               the phone an operator holds — just no longer competing with the
               destinations they explain. */
            "pressable shrink-0 rounded-lg p-1.5 transition-colors",
            open
              ? "bg-brand-50 text-brand-700 dark:text-brand-600"
              : "text-ink-300 hover:bg-ink-300/20 hover:text-ink-600",
          )}
        >
          <Info className="size-3.5" aria-hidden />
        </button>
      </div>

      {/* Rendered only when open: an always-present hidden paragraph would be
          read out by a screen reader on every row, which is thirteen sentences
          of noise before the first destination. */}
      {open ? (
        <p
          id={hintId}
          className={cn(
            "mt-1 rounded-lg bg-brand-50/70 py-2 text-xs leading-relaxed text-ink-600",
            compact ? "px-3" : "px-3.5",
          )}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}
