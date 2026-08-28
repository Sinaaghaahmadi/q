import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function Input({ className, invalid, ...props }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(
        "h-11 w-full rounded-xl border border-ink-300 bg-surface px-4 text-sm text-ink-900 transition-colors",
        "focus:border-brand-600 focus:ring-2 focus:ring-brand-600/25 focus:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        invalid && "border-down focus:border-down focus:ring-down/25",
        className,
      )}
      {...props}
    />
  );
}
