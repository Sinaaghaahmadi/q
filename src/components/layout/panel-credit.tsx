import * as React from "react";
import { versionLabel } from "@/lib/version";
import { cn } from "@/lib/utils";

/**
 * Which build this is, and who built it.
 *
 * Two facts that belong together and are usually separated: support's first
 * question is the version, and the person to ask about it is the team that
 * wrote the thing. Both consoles print them in the same place, in the quietest
 * type on the page — present for whoever needs them, invisible to whoever is
 * working.
 */
export function PanelCredit({ builtBy, className }: { builtBy: string; className?: string }) {
  return (
    <div className={cn("px-3 pt-4", className)}>
      <p className="font-mono text-[0.6875rem] text-ink-600/60" dir="ltr">
        {versionLabel()}
      </p>
      <p className="mt-1 text-[0.6875rem] text-ink-600/60">{builtBy}</p>
    </div>
  );
}
