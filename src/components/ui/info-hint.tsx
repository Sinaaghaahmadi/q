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
export function InfoHint({
  term,
  className,
  label,
}: {
  /** Key under the `glossary` namespace: `glossary.<term>.title` / `.body`. */
  term: string;
  className?: string;
  /** Optional visible text before the icon, e.g. a field label. */
  label?: React.ReactNode;
}) {
  const t = useTranslations("glossary");
  const [open, setOpen] = React.useState(false);
  const wrap = React.useRef<HTMLSpanElement>(null);
  const id = React.useId();

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
        aria-label={t("open", { term: t(`${term}.title`) })}
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
          className="absolute start-0 top-[calc(100%+0.5rem)] z-50 block w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-ink-300/60 bg-surface p-3 text-start shadow-e2"
        >
          <span className="flex items-start gap-2">
            <span className="flex-1">
              <span className="block text-xs font-semibold text-ink-900">{t(`${term}.title`)}</span>
              <span className="mt-1 block text-xs leading-relaxed font-normal text-ink-600">
                {t(`${term}.body`)}
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
