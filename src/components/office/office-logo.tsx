import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/**
 * An office, as a round pane of glass.
 *
 * The same material as the bank tokens in settlement and the rate boxes on the
 * board, on purpose: an order that shows the office's logo next to its bank
 * should look like two objects from one world, not two component libraries
 * meeting.
 *
 * An office with no logo is not a broken office. It gets its own initial on a
 * disc tinted with a hue derived from its id — stable, so the same office is
 * the same colour on every screen and in every session, and distinct enough
 * that a list of eight offices does not look like a list of one. Plenty of
 * real exchange offices will never upload anything, and the fallback has to be
 * good enough that they are not visibly the ones who did not bother.
 */
export function OfficeLogo({
  name,
  logoUrl,
  officeId,
  size = 40,
  className,
}: {
  /** The office's display name. Its first character becomes the fallback. */
  name: string | null | undefined;
  /** Public URL from the `office-logos` bucket, or null. */
  logoUrl?: string | null;
  /** Seeds the fallback hue, so an office keeps its colour everywhere. */
  officeId?: string | null;
  size?: number;
  className?: string;
}) {
  const initial = firstLetter(name);
  const tint = hueFor(officeId ?? name ?? "");

  return (
    <span
      className={cn(
        "glass inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full",
        className,
      )}
      style={{ width: size, height: size, "--glass-tint": tint } as CSSProperties}
      // The name is carried by the text beside this in every place it is used,
      // so the mark itself is decoration and repeating the name would just make
      // a screen reader say it twice.
      aria-hidden
    >
      {logoUrl ? (
        // Not next/image: these are user uploads on a Supabase origin, and
        // routing them through the optimiser would mean either allow-listing a
        // remote pattern per project or paying for transformations on a 40px
        // avatar. The bucket already caps them at 512 kB.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=""
          width={size}
          height={size}
          className="size-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span className="font-semibold" style={{ color: tint, fontSize: Math.round(size * 0.42) }}>
          {initial}
        </span>
      )}
    </span>
  );
}

/**
 * The first character that is actually a letter.
 *
 * `Array.from` rather than `[0]` because a name may begin with a character
 * outside the basic plane, and slicing a surrogate pair in half renders a
 * replacement glyph — a poor first impression for an office called 🏦.
 */
function firstLetter(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();
  if (trimmed === "") return "؟";
  return Array.from(trimmed)[0] ?? "؟";
}

/**
 * A stable hue per office.
 *
 * FNV-1a over the id, mapped onto the colour wheel. Deterministic, so the tint
 * is the same on the server and the client and never flickers on hydration.
 */
function hueFor(seed: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `hsl(${Math.abs(hash) % 360} 62% 42%)`;
}

/** The public URL of an office's logo, or null when it has none. */
export function officeLogoUrl(logoPath: string | null | undefined): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!logoPath || !base) return null;
  return `${base}/storage/v1/object/public/office-logos/${logoPath}`;
}
