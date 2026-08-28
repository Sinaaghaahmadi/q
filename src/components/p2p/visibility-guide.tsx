import { getTranslations } from "next-intl/server";
import * as React from "react";
import { Card } from "@/components/ui/card";

/**
 * Why one offer sits above another, said plainly.
 *
 * A marketplace that sorts by something invisible feels rigged even when it is
 * not. Four levers, in the order of how much they actually move you, with the
 * strongest one first — and price is genuinely the strongest, which is worth
 * admitting rather than burying under "engagement".
 *
 * The tiles carry small dimensional glyphs rather than flat line icons: this is
 * the one screen where a bit of shine is on-brief, because the marketplace is
 * where the product asks someone to compete, and the currency coins beside
 * these offers already set that register. Everything is drawn from tokens, so
 * both themes and both directions come out right with no per-theme artwork.
 */
const LEVERS = ["price", "reputation", "speed", "clarity"] as const;

export async function VisibilityGuide() {
  const t = await getTranslations("p2p.visibility");

  return (
    <section aria-labelledby="p2p-visibility">
      <h2 id="p2p-visibility" className="text-lg font-semibold">
        {t("title")}
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-ink-600">{t("subtitle")}</p>
      <div className="list-rise mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {LEVERS.map((key, index) => (
          <Card key={key} style={{ "--i": index } as React.CSSProperties} className="p-5">
            <LeverGlyph lever={key} rank={index + 1} />
            <h3 className="mt-4 text-sm font-semibold">{t(`items.${key}.title`)}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{t(`items.${key}.body`)}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}

/**
 * A 56px dimensional glyph per lever.
 *
 * Same rig for all four: a brand-tinted plate seen slightly from above, a soft
 * contact shadow beneath it, one key light from the upper-start corner, and the
 * subject sitting on the plate. Shared lighting is what keeps four different
 * drawings reading as one set.
 */
function LeverGlyph({ lever, rank }: { lever: (typeof LEVERS)[number]; rank: number }) {
  return (
    <span className="relative inline-flex">
      <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden focusable="false">
        <defs>
          <linearGradient id={`plate-${lever}`} x1="0" y1="0" x2="0.6" y2="1">
            <stop offset="0%" stopColor="var(--brand-600)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--brand-600)" stopOpacity="0.08" />
          </linearGradient>
          <linearGradient id={`face-${lever}`} x1="0.2" y1="0" x2="0.8" y2="1">
            <stop offset="0%" stopColor="var(--brand-600)" />
            <stop offset="100%" stopColor="var(--brand-700)" />
          </linearGradient>
        </defs>

        {/* Contact shadow: the plate sits on something. */}
        <ellipse cx="28" cy="49" rx="17" ry="3.4" fill="var(--ink-900)" opacity="0.1" />
        {/* The plate, with a lit top edge. */}
        <rect x="8" y="10" width="40" height="36" rx="12" fill={`url(#plate-${lever})`} />
        <path
          d="M20 10h16a12 12 0 0 1 12 12v1a12 12 0 0 0-12-12H20a12 12 0 0 0-12 12v-1a12 12 0 0 1 12-12Z"
          fill="var(--surface)"
          opacity="0.5"
        />

        <g fill={`url(#face-${lever})`}>
          {lever === "price" ? (
            // A tag tilted off-axis, so it reads as an object rather than a symbol.
            <>
              <path d="M26 18h9a3 3 0 0 1 3 3v9a3 3 0 0 1-.9 2.1l-8 8a3 3 0 0 1-4.2 0l-7-7a3 3 0 0 1 0-4.2l8-8A3 3 0 0 1 26 18Z" />
              <circle cx="32.5" cy="24.5" r="2.4" fill="var(--surface)" />
            </>
          ) : null}
          {lever === "reputation" ? (
            // A star with one facet lifted into the light.
            <>
              <path d="M28 17.5l3.2 6.6 7.3 1-5.3 5.1 1.3 7.2L28 34l-6.5 3.4 1.3-7.2-5.3-5.1 7.3-1L28 17.5Z" />
              <path
                d="M28 17.5l3.2 6.6 7.3 1-5.3 5.1-5.2-12.7Z"
                fill="var(--surface)"
                opacity="0.28"
              />
            </>
          ) : null}
          {lever === "speed" ? (
            // A dial whose needle has swung to the fast end.
            <>
              <path d="M28 17a13 13 0 0 1 13 13h-5a8 8 0 0 0-8-8 8 8 0 0 0-8 8h-5a13 13 0 0 1 13-13Z" />
              <rect x="26.6" y="24" width="2.8" height="13" rx="1.4" transform="rotate(38 28 30)" />
              <circle cx="28" cy="30" r="3" fill="var(--surface)" />
            </>
          ) : null}
          {lever === "clarity" ? (
            // A sheet with lines, its top corner folded toward the light.
            <>
              <path d="M20 17h11l7 7v15a2 2 0 0 1-2 2H20a2 2 0 0 1-2-2V19a2 2 0 0 1 2-2Z" />
              <path d="M31 17l7 7h-7v-7Z" fill="var(--surface)" opacity="0.42" />
              <g fill="var(--surface)" opacity="0.85">
                <rect x="22" y="28" width="12" height="2" rx="1" />
                <rect x="22" y="33" width="9" height="2" rx="1" />
              </g>
            </>
          ) : null}
        </g>
      </svg>

      {/* Rank badge — the levers are listed strongest-first and the number says so. */}
      <span className="num absolute -end-1 -top-1 flex size-5 items-center justify-center rounded-full bg-brand-solid text-[0.625rem] font-bold text-white shadow-e1">
        {rank}
      </span>
    </span>
  );
}
