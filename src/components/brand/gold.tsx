import * as React from "react";
import { goldSvg } from "@/lib/brand/gold-svg";
import type { CoinCode } from "@/lib/coins/catalog";
import { cn } from "@/lib/utils";

/**
 * A gold coin or bar. Server-renderable; the SVG comes from our own generator
 * with no user input in it, which is what makes the raw insertion safe.
 */
export function GoldIcon({
  code,
  size = 44,
  className,
}: {
  code: CoinCode;
  size?: number;
  className?: string;
}) {
  const id = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <span
      className={cn("inline-block shrink-0 select-none [&>svg]:size-full", className)}
      style={{ width: size, height: size }}
      aria-hidden
      dangerouslySetInnerHTML={{ __html: goldSvg(code, `g${id}${code}`) }}
    />
  );
}
