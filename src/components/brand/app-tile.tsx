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
