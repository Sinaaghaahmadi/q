"use client";

import { Info, X } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The small `i` beside a word nobody should have to already know.
 *
 * A currency app is full of terms that are precise and useless: spread, basis
 * points, mid rate, IBAN check digit, escrow, banded commission. Writing them
 * into the interface and hoping is how a product ends up understood only by the
 * people who built it; writing a paragraph of explanation instead is how a
 * screen ends up unreadable. So the plain word goes in the sentence and the
 * exact one goes behind this — available to whoever wants it, invisible to
 * whoever does not.
 *
 * It is a button, not a hover target: on a phone there is no hover, and a
 * definition that only appears to people with a mouse is not a definition. Text
 * comes from the `glossary` namespace so every occurrence of a term explains it
 * the same way, and translating a term means translating it once.
 */
type InfoHintProps = {
  className?: string;
  /** Optional visible text before the icon, e.g. a field label. */
  label?: React.ReactNode;
  /** Where the panel opens from. `end` keeps it on screen at a card's edge. */
  align?: "start" | "end";
} & (
  | {
      /** Key under the `glossary` namespace: `glossary.<term>.title` / `.body`. */
      term: string;
      title?: never;
      body?: never;
    }
  | {
      term?: never;
      /** Heading for a one-off explanation that is not a glossary term. */
      title: string;
      /** The sentence itself. */
      body: string;
    }
);

export function InfoHint({ term, title, body, className, label, align = "start" }: InfoHintProps) {
  const t = useTranslations("glossary");
  const [open, setOpen] = React.useState(false);
  const wrap = React.useRef<HTMLSpanElement>(null);
  const id = React.useId();

  /* Two callers, one control. A glossary term explains itself the same way
     everywhere and is looked up by key; a panel section explains what *it*
     does, which is a sentence that exists in one place and has no business
     being a glossary entry. Rather than a second near-identical component
     with its own popover, its own outside-click handling and its own drift,
     the text is either looked up or handed in. */
  const heading = title ?? t(`${term}.title`);
  const text = body ?? t(`${term}.body`);

  React.useEffect(() => {
    if (!open) return;
    function onDown(event: MouseEvent | TouchEvent) {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={wrap} className={cn("relative inline-flex items-center gap-1", className)}>
      {label}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={t("open", { term: heading })}
        className={cn(
          "inline-flex size-4.5 shrink-0 items-center justify-center rounded-full border align-middle transition-colors",
          open
            ? "border-info bg-info text-white"
            : "border-ink-300 text-ink-600 hover:border-info hover:text-info",
        )}
      >
        <Info className="size-3" aria-hidden />
      </button>

      {open ? (
        <span
          id={id}
          role="note"
          /* Anchored to the trigger and clamped to the viewport width, because
             these sit inside tight table rows where a fixed-width panel would
             hang off the edge of a phone. */
          className={cn(
            "absolute top-[calc(100%+0.5rem)] z-50 block w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-ink-300/60 bg-surface p-3 text-start shadow-e2",
            align === "end" ? "end-0" : "start-0",
          )}
        >
          <span className="flex items-start gap-2">
            <span className="flex-1">
              <span className="block text-xs font-semibold text-ink-900">{heading}</span>
              <span className="mt-1 block text-xs leading-relaxed font-normal text-ink-600">
                {text}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t("close")}
              className="-m-1 rounded p-1 text-ink-600 hover:text-ink-900"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </span>
        </span>
      ) : null}
    </span>
  );
}
