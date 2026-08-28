import type { LucideIcon } from "lucide-react";
import * as React from "react";
import { AppTile, type TileHue } from "@/components/brand/app-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

interface EmptyStateProps {
  icon: LucideIcon;
  /**
   * An animated scene, for the screens where the emptiness is a *moment* —
   * a wrong address, a lost connection, a door that is not yours — rather
   * than a list that will fill up on its own. When present it replaces the
   * tile; `icon` stays required so every caller has a fallback shape.
   */
  scene?: React.ComponentType<{ size?: number; label?: string }>;
  /**
   * Which of the seven tile hues this emptiness means. A list with nothing in
   * it yet is not the same event as a door that is not yours, and the colour
   * says which before the sentence under it is read.
   */
  hue?: TileHue;
  title: string;
  description: string;
  phaseLabel?: string;
  ctaLabel?: string;
  ctaHref?: string;
}

/**
 * Calm empty state (§13): one object, one sentence, one way forward.
 *
 * The object used to be a flat stroke in a pale green circle with a smudge of
 * blur under it — a shape drawn nowhere else in the product, on the one screen
 * that has nothing else to look at. It is the app tile now, at the size a phone
 * draws an icon on an empty folder: the same lit dome the menu rows, the
 * profile cards and the home services carry, so an empty page still looks like
 * this app rather than like a page that failed to load.
 *
 * `icon` stays a component rather than a rendered node, unlike `AppTile` and
 * `NavRow`: this renders on the server for all 44 of its callers, and every one
 * of them passes the lucide component. Turning it into a node would touch 44
 * files to fix a boundary problem that does not exist here.
 */
export function EmptyState({
  icon: Icon,
  scene: SceneComponent,
  hue = "brand",
  title,
  description,
  phaseLabel,
  ctaLabel,
  ctaHref = "/",
}: EmptyStateProps) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
      {SceneComponent ? (
        <SceneComponent size={148} label={title} />
      ) : (
        <AppTile hue={hue} size="xl">
          <Icon />
        </AppTile>
      )}
      <h1 className="mt-6 text-xl font-bold">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-600">{description}</p>
      {phaseLabel ? (
        <Badge variant="info" className="mt-4">
          {phaseLabel}
        </Badge>
      ) : null}
      {ctaLabel ? (
        <Button asChild className="mt-6">
          <Link href={ctaHref}>{ctaLabel}</Link>
        </Button>
      ) : null}
    </div>
  );
}
