import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        neutral: "bg-ink-300/30 text-ink-600",
        brand: "bg-brand-50 text-brand-700 dark:text-brand-600",
        up: "bg-up/12 text-up",
        down: "bg-down/12 text-down",
        warn: "bg-warn/12 text-warn",
        info: "bg-info/12 text-info",
        outline: "border border-ink-300 text-ink-600",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
