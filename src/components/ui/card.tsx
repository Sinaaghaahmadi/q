import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The default surface.
 *
 * `data-card` is not decoration: inside a staff console (`[data-panel]`) the
 * stylesheet swaps this solid surface for the glass one, so both panels are
 * cut from the same material as their own controls and as the rate boxes on
 * the customer side — without forty call sites each passing the same prop, and
 * without the customer surface changing at all.
 */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-card
      /* Only the shape here. The surface itself — border, background, shadow —
         is a `[data-card]` rule in the stylesheet, because Tailwind's utility
         layer beats the components layer no matter the specificity, and a
         `bg-surface` class on this element would win against the console's
         glass rule and quietly undo it. A caller's own `bg-*` still overrides
         both, which is the behaviour every existing caller expects. */
      className={cn("rounded-2xl", className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1.5 p-6 pb-0", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-base font-semibold", className)} {...props} />;
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-ink-600", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6", className)} {...props} />;
}
