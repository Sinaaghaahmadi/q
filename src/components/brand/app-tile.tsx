import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The lit, domed square an icon sits on (§2.6).
 *
 * Same rig as the 3D coin — light from above, a hairline along the top edge, a
 * gloss over the upper half, a shadow cast in the object's own colour — applied
 * to the icons in a grouped list. Flat strokes in a pale square told the rows
 * apart only by reading them; this is recognisable at a glance and at speed,
 * which is the whole job of an icon in a menu.
 *
 * The hue carries meaning rather than decoration, so seven serve fourteen rows:
 * money is green, authority indigo, contact sky, help teal, caution amber,
 * paperwork slate, a complaint rose.
 */
export type TileHue = "brand" | "indigo" | "sky" | "teal" | "amber" | "slate" | "rose";

const HUE: Record<TileHue, string> = {
  brand: "[--tile:var(--tile-brand)]",
  indigo: "[--tile:var(--tile-indigo)]",
  sky: "[--tile:var(--tile-sky)]",
  teal: "[--tile:var(--tile-teal)]",
  amber: "[--tile:var(--tile-amber)]",
  slate: "[--tile:var(--tile-slate)]",
  rose: "[--tile:var(--tile-rose)]",
};

export function AppTile({
  hue = "brand",
  size = "md",
  children,
  className,
}: {
  hue?: TileHue;
  /** `md` beside a list row, `lg` on a card people tap. */
  size?: "md" | "lg";
  /** The icon, already rendered — a function in a prop cannot reach a client. */
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "app-tile",
        HUE[hue],
        size === "lg" ? "size-12 [&>svg]:size-6" : "size-9 [&>svg]:size-[1.15rem]",
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * A section heading with its tile.
 *
 * The profile page is a stack of cards, and a card whose title is bare text
 * reads as a paragraph with a bold first line. The same tile the menu rows
 * carry marks each one as a *place* — and it costs nothing, because the icon
 * and the hue already exist for that idea elsewhere in the product.
 */
export function TileHeading({
  hue,
  icon,
  title,
  subtitle,
  action,
  className,
}: {
  hue?: TileHue;
  /** Already rendered. */
  icon: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-3.5", className)}>
      <AppTile hue={hue} size="lg">
        {icon}
      </AppTile>
      <div className="min-w-0 flex-1 pt-0.5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {subtitle ? (
          <div className="mt-1 text-sm leading-relaxed text-ink-600">{subtitle}</div>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
