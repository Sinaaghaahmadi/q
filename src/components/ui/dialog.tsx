"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;

/**
 * `variant="sheet"` renders a bottom sheet on mobile (§2.5:
 * bottom-sheet-first on mobile, modal on desktop) — sheet below `sm`,
 * centered modal above it.
 */
export function DialogContent({
  className,
  children,
  variant = "modal",
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { variant?: "modal" | "sheet" }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn(
          "fixed inset-0 z-50 bg-ink-900/40 backdrop-blur-[2px]",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          "dark:bg-black/60",
        )}
      />
      <DialogPrimitive.Content
        className={cn(
          "fixed z-50 flex max-h-[85dvh] w-full flex-col overflow-hidden border border-ink-300/50 bg-surface shadow-e3 focus:outline-none",
          variant === "sheet"
            ? cn(
                "inset-x-0 bottom-0 rounded-t-3xl pb-safe",
                "sm:inset-x-auto sm:start-1/2 sm:top-1/2 sm:bottom-auto sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl rtl:sm:translate-x-1/2",
              )
            : cn(
                "inset-x-4 top-1/2 mx-auto max-w-md -translate-y-1/2 rounded-2xl",
                "sm:inset-x-auto sm:start-1/2 sm:-translate-x-1/2 rtl:sm:translate-x-1/2",
              ),
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className="absolute end-3 top-3 rounded-lg p-2 text-ink-600 transition-colors hover:bg-ink-300/25 hover:text-ink-900"
          aria-label="Close"
        >
          <X className="size-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
