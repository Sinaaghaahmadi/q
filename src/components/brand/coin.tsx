import * as React from "react";
import { coinSvg } from "@/lib/brand/coin-svg";
import type { CurrencyCode } from "@/lib/rates/catalog";
import { cn } from "@/lib/utils";

interface CoinIconProps {
  code: CurrencyCode;
  size?: number;
  className?: string;
}

/**
 * 3D coin icon (§2.6). Server-renderable; the SVG string comes from our own
 * generator (trusted, no user input).
 */
export function CoinIcon({ code, size = 36, className }: CoinIconProps) {
  const id = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <span
      className={cn("inline-block shrink-0 select-none [&>svg]:size-full", className)}
      style={{ width: size, height: size }}
      aria-hidden
      dangerouslySetInnerHTML={{ __html: coinSvg(code, `c${id}${code}`) }}
    />
  );
}
