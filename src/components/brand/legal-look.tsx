import { FileText, Lock, MessageSquareWarning, Percent, ScanSearch, Timer } from "lucide-react";
import * as React from "react";
import { type TileHue } from "@/components/brand/app-tile";
import type { LEGAL_SLUGS } from "@/content/legal";

/**
 * The legal set, told apart.
 *
 * Six identical document icons is a wall of paper, and the two rows people
 * actually come for — what it costs, and what happens when it goes wrong — are
 * the hardest to find in it. So each carries the shape of its subject and a hue
 * that means something: money green, a promise about time amber, a complaint
 * rose.
 *
 * Shared between the navigation sheet and the pages themselves so the icon a
 * reader tapped is the icon at the top of what opens. Elements rather than
 * components: the menu is a client component and the pages are not, and only
 * one of those two can be handed a function.
 */
export const LEGAL_LOOK: Record<
  (typeof LEGAL_SLUGS)[number],
  { icon: React.ReactNode; hue: TileHue }
> = {
  terms: { icon: <FileText />, hue: "slate" },
  privacy: { icon: <Lock />, hue: "indigo" },
  aml: { icon: <ScanSearch />, hue: "amber" },
  fees: { icon: <Percent />, hue: "brand" },
  sla: { icon: <Timer />, hue: "amber" },
  complaints: { icon: <MessageSquareWarning />, hue: "rose" },
};
