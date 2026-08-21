import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { formatChangePct, type AppLocale } from "@/lib/money/format";

interface ChangeChipProps {
  pct: number;
  locale: AppLocale;
  className?: string;
}

/**
 * 24h change chip. Color is never the only signal (§2.3): the arrow glyph and
 * the explicit sign always ride along.
 */
export function ChangeChip({ pct, locale, className }: ChangeChipProps) {
  const variant = pct > 0.005 ? "up" : pct < -0.005 ? "down" : "neutral";
  const Icon = variant === "up" ? ArrowUpRight : variant === "down" ? ArrowDownRight : Minus;
  return (
    <Badge variant={variant} className={className}>
      <Icon className="size-3.5" aria-hidden />
      <span className="num" dir="ltr">
        {formatChangePct(pct, locale)}
      </span>
    </Badge>
  );
}
