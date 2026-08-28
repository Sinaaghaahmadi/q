import type { CSSProperties } from "react";
import { BANK_MARKS, markFor } from "@/lib/banks/marks";
import { bankById } from "@/lib/validators";
import { cn } from "@/lib/utils";

/**
 * A bank as a round glass token.
 *
 * Round and glassy is the shape the brief asks for on office logos, and using
 * the same token for banks means a settlement screen showing an office's logo
 * beside its bank reads as one set of objects rather than two borrowed
 * component libraries.
 *
 * The tint is the bank's own colour, but it is *only* a tint: the mark itself
 * is stroked in that colour at full strength so it stays legible on the 3:1
 * side of the contrast line, while the disc behind it stays close to the
 * surface. A picker where every tile is a saturated square is a paint chart.
 */
export function BankMark({
  bankId,
  size = 40,
  className,
}: {
  bankId: string | null | undefined;
  /** Rendered diameter in pixels. The mark scales with it. */
  size?: number;
  className?: string;
}) {
  const bank = bankById(bankId);
  const tint = bank?.color ?? "var(--brand-600)";
  const path = BANK_MARKS[markFor(bankId)];

  return (
    <span
      aria-hidden
      className={cn(
        "glass inline-flex shrink-0 items-center justify-center rounded-full",
        className,
      )}
      style={{ width: size, height: size, "--glass-tint": tint } as CSSProperties}
    >
      <svg
        viewBox="0 0 24 24"
        width={Math.round(size * 0.55)}
        height={Math.round(size * 0.55)}
        fill="none"
        stroke={tint}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={path} />
      </svg>
    </span>
  );
}
