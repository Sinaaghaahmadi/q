import { ArrowUpRight } from "lucide-react";
import * as React from "react";
import { AppTile, type TileHue } from "@/components/brand/app-tile";
import { InfoHint } from "@/components/ui/info-hint";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * One block of a staff panel, with its own explanation and its own way in.
 *
 * Two things every section on a console owes the person reading it, and almost
 * no console gives:
 *
 * The first is what it *is*. "دفتر کل", "نقدینگی", "کارنامهٔ صرافی‌ها" — each is
 * the correct name and each is opaque until somebody has already been shown.
 * The sidebar already explains its destinations; a card in the middle of a page
 * explained nothing, so every one of them now carries the same `i` and answers
 * in a sentence.
 *
 * The second is a way further in. A manager reading a number wants the rows
 * behind it, and a card that shows a total and stops there ends the
 * investigation at the interesting part. When `href` is given the heading
 * becomes a link and the corner carries an arrow, so the whole header is one
 * obvious "open this" without making the card itself a click target — cards
 * here contain buttons, and a clickable card that swallows its own buttons is
 * worse than no link at all.
 *
 * The surface is glass, matching the controls inside it and the rate boxes on
 * the customer side: one material for the whole product.
 */
export function PanelSection({
  icon,
  iconHue,
  title,
  hint,
  href,
  linkLabel,
  actions,
  footer,
  children,
  className,
  bodyClassName,
  headerClassName,
}: {
  /** A rendered element, never a component — functions do not cross to a client. */
  icon?: React.ReactNode;
  /** Which of the seven tile hues the section's icon carries. */
  iconHue?: TileHue;
  title: string;
  /** One sentence on what this section is for, already translated. */
  hint: string;
  /** Where the full view of this section lives, if there is one. */
  href?: string;
  /** Accessible name for the arrow, e.g. "open the full list". */
  linkLabel?: string;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  headerClassName?: string;
}) {
  const heading = (
    <h2 className="truncate text-base font-semibold">
      {href ? (
        <Link
          href={href}
          className="transition-colors hover:text-brand-700 dark:hover:text-brand-600"
        >
          {title}
        </Link>
      ) : (
        title
      )}
    </h2>
  );

  return (
    <section
      className={cn(
        "glass glass-lift overflow-hidden rounded-2xl [--glass-tint:transparent]",
        className,
      )}
    >
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-ink-300/35 bg-ink-300/[0.07] px-5 py-3.5",
          headerClassName,
        )}
      >
        {/* The same lit tile the customer surface uses, so a section header
            in a panel and a row in the app menu are recognisably one product. */}
        {icon ? <AppTile hue={iconHue}>{icon}</AppTile> : null}

        <div className="flex min-w-0 items-center gap-1.5">
          {heading}
          <InfoHint title={title} body={hint} />
        </div>

        <div className="ms-auto flex shrink-0 items-center gap-1.5">
          {actions}
          {href ? (
            <Link
              href={href}
              aria-label={linkLabel ?? title}
              title={linkLabel ?? title}
              className="pressable inline-flex size-8 items-center justify-center rounded-lg text-ink-600 transition-colors hover:bg-ink-300/20 hover:text-ink-900"
            >
              {/* Mirrored in RTL by the logical rotation, so the arrow points
                  the way the reader travels rather than the way English does. */}
              <ArrowUpRight className="size-4 rtl:-scale-x-100" aria-hidden />
            </Link>
          ) : null}
        </div>
      </div>

      <div className={cn("p-5", bodyClassName)}>{children}</div>

      {footer ? (
        <div className="border-t border-ink-300/35 px-5 py-3 text-xs leading-relaxed text-ink-600">
          {footer}
        </div>
      ) : null}
    </section>
  );
}
