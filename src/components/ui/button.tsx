import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Buttons, in one material.
 *
 * The panels asked for glass, and glass is only convincing if it is the same
 * pane everywhere: `.glass-control` carries the recipe and each variant does
 * nothing but choose the tint and the text colour. That is why `secondary` and
 * `soft` are no longer a bordered box and a flat brand wash — they were two
 * different surfaces standing next to the rate boxes, which are glass.
 *
 * Two variants stay solid on purpose. `primary` is the one action a screen is
 * asking for and `destructive` is the one it should hesitate over; both need to
 * be readable against whatever happens to be behind them, and a translucent
 * confirm button on a busy console is a contrast problem waiting for the one
 * screen nobody tested. They get the same hairline of light along the top edge
 * so they still read as cut from the same sheet.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium transition-[background-color,color,transform,box-shadow,border-color] duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-brand-solid text-white shadow-e1 inset-shadow-[0_1px_0_rgb(255_255_255/0.22)] hover:bg-brand-700",
        secondary: "glass-control text-ink-900 [--glass-tint:var(--ink-600)]",
        soft: "glass-control text-brand-700 [--glass-tint:var(--brand-600)] dark:text-brand-600",
        /** Neutral glass for panel toolbars, where nothing should shout. */
        glass: "glass-control text-ink-600 hover:text-ink-900 [--glass-tint:var(--ink-600)]",
        ghost: "text-ink-600 hover:bg-ink-300/25 hover:text-ink-900",
        destructive:
          "bg-danger-solid text-white inset-shadow-[0_1px_0_rgb(255_255_255/0.22)] hover:opacity-90",
      },
      size: {
        sm: "h-9 px-3.5 text-sm",
        md: "h-11 px-5 text-sm",
        lg: "h-12 px-6 text-base",
        icon: "size-11",
        iconSm: "size-9",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { buttonVariants };
