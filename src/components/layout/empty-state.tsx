import type { LucideIcon } from "lucide-react";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  phaseLabel?: string;
  ctaLabel?: string;
  ctaHref?: string;
}

/** Calm empty state (§13): gentle illustration, one clear CTA. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  phaseLabel,
  ctaLabel,
  ctaHref = "/",
}: EmptyStateProps) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
      <span className="relative flex size-24 items-center justify-center">
        <span className="absolute inset-0 rounded-full bg-brand-50" aria-hidden />
        <span
          className="absolute start-1/2 -bottom-1 h-2 w-16 -translate-x-1/2 rounded-full bg-ink-900/10 blur-sm rtl:translate-x-1/2"
          aria-hidden
        />
        <Icon className="relative size-10 text-brand-600" aria-hidden />
      </span>
      <h1 className="mt-6 text-xl font-bold">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-600">{description}</p>
      {phaseLabel ? (
        <Badge variant="info" className="mt-4">
          {phaseLabel}
        </Badge>
      ) : null}
      {ctaLabel ? (
        <Button asChild className="mt-6">
          <Link href={ctaHref}>{ctaLabel}</Link>
        </Button>
      ) : null}
    </div>
  );
}
