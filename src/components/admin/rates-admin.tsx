"use client";

import { CircleAlert, CircleCheck, Save } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import * as React from "react";
import { PanelSection } from "@/components/layout/panel-section";
import { ChangeChip } from "@/components/rates/change-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  formatDate,
  formatNumber,
  formatRate,
  parseAmountInput,
  type AppLocale,
} from "@/lib/money/format";
import { FOREIGN_CODES } from "@/lib/rates/catalog";
import type { RatesSnapshot } from "@/lib/rates/types";
import { createClient } from "@/lib/supabase/client";
import { SPREAD_BOUNDS_KEY } from "@/lib/admin/filters";
import type { RateSource } from "@/lib/supabase/types";

/** The one `settings` row this screen owns. */

export type SpreadBounds = { floor_bps: number; ceiling_bps: number };

export type OfficeRef = { id: string; nameFa: string; nameEn: string };

/** One corridor's spread as it stands across every office quoting it. */
export type CorridorSpread = {
  corridor: string;
  offices: number;
  minBps: number;
  medianBps: number;
  maxBps: number;
  lowest: OfficeRef | null;
  highest: OfficeRef | null;
};

/** Offered when the row is absent — a suggestion, enforced by nobody until saved. */
const DEFAULT_BOUNDS: SpreadBounds = { floor_bps: 0, ceiling_bps: 500 };

/**
 * The highest spread an office can actually be given: both spread editors
 * (`office-config.tsx` here and the office's own `rate-config-editor.tsx`)
 * refuse anything above it. A ceiling beyond that would mark corridors out of
 * range that no office is able to move inside.
 */
const MAX_SPREAD_BPS = 2000;

const PAIR_ORDER = new Map<string, number>(
  FOREIGN_CODES.map((code, index) => [code, index] as const),
);

/** Basis points typed by hand: Persian or Latin digits, whole numbers only. */
function bps(raw: string): number | null {
  const value = parseAmountInput(raw);
  return value !== null && Number.isInteger(value) ? value : null;
}

/**
 * §4.3 /admin/rates: where the numbers come from, whether the pipes are open,
 * and the range every office is priced inside.
 *
 * The freshness banner leads the page rather than sitting beside the table.
 * A stale rate that nobody noticed is the most expensive thing this screen can
 * produce (§7.1) — it becomes a dispute days later — so the state of the
 * snapshot is stated before any number from it is shown.
 */
export function RatesAdmin({
  snapshot,
  sources,
  bounds,
  boundsStored,
  boundsUpdatedAt,
  corridors,
}: {
  snapshot: RatesSnapshot;
  sources: RateSource[];
  bounds: SpreadBounds | null;
  /** True when the row exists, whether or not it could be read as a range. */
  boundsStored: boolean;
  boundsUpdatedAt: string | null;
  corridors: CorridorSpread[];
}) {
  const t = useTranslations("admin.rates");
  const locale = useLocale() as AppLocale;
  const router = useRouter();

  const [floor, setFloor] = React.useState(String((bounds ?? DEFAULT_BOUNDS).floor_bps));
  const [ceiling, setCeiling] = React.useState(String((bounds ?? DEFAULT_BOUNDS).ceiling_bps));
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<string | null>(null);

  const floorDraft = bps(floor);
  const ceilingDraft = bps(ceiling);
  const valid =
    floorDraft !== null &&
    ceilingDraft !== null &&
    floorDraft >= 0 &&
    ceilingDraft > floorDraft &&
    ceilingDraft <= MAX_SPREAD_BPS;

  const quotes = Object.values(snapshot.rates).sort(
    (a, b) =>
      (PAIR_ORDER.get(a.base) ?? PAIR_ORDER.size) - (PAIR_ORDER.get(b.base) ?? PAIR_ORDER.size),
  );

  /*
   * The office behind a number, named and openable.
   *
   * This table exists to find the office charging the widest spread; naming it
   * and then leaving the reader to go and search for it is most of the work
   * still undone. The link is the answer to the question the table raised.
   */
  const officeName = (office: OfficeRef | null) =>
    office ? (
      <Link
        href={`/admin/exchanges/${office.id}`}
        className="hover:text-brand-700 dark:hover:text-brand-600"
      >
        {locale === "fa" ? office.nameFa : office.nameEn}
      </Link>
    ) : (
      "—"
    );

  const means = (value: number) =>
    t("bounds.means", {
      bps: formatNumber(value, locale),
      pct: formatNumber(value / 100, locale, { maximumFractionDigits: 2 }),
    });

  const stamp = (at: string) => formatDate(at, locale, { dateStyle: "short", timeStyle: "short" });

  async function saveBounds() {
    const nextFloor = bps(floor);
    const nextCeiling = bps(ceiling);
    if (
      nextFloor === null ||
      nextCeiling === null ||
      nextFloor < 0 ||
      nextCeiling <= nextFloor ||
      nextCeiling > MAX_SPREAD_BPS
    ) {
      setError(t("bounds.invalid", { max: formatNumber(MAX_SPREAD_BPS, locale) }));
      return;
    }
    setBusy(true);
    setError(null);
    setNote(null);
    const supabase = createClient();
    const { error: dbError } = await supabase.from("settings").upsert({
      key: SPREAD_BOUNDS_KEY,
      value: { floor_bps: nextFloor, ceiling_bps: nextCeiling },
    });
    setBusy(false);
    if (dbError) {
      setError(t("bounds.saveFailed"));
      return;
    }
    setNote(t("bounds.saved"));
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {snapshot.degraded ? (
        <Card className="flex items-start gap-3 bg-warn/12 p-5 text-warn-ink">
          <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="min-w-0 space-y-1.5">
            <p className="flex flex-wrap items-center gap-2 font-semibold">
              {t("snapshot.degradedTitle")}
              <Badge variant="warn">{t("snapshot.staleBadge")}</Badge>
            </p>
            <p className="text-sm leading-relaxed">{t("snapshot.degradedBody")}</p>
          </div>
        </Card>
      ) : (
        <Card className="flex items-start gap-3 bg-up/12 p-5 text-up-ink">
          <CircleCheck className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="min-w-0 space-y-1.5">
            <p className="font-semibold">{t("snapshot.okTitle")}</p>
            <p className="text-sm leading-relaxed">{t("snapshot.okBody")}</p>
          </div>
        </Card>
      )}

      <PanelSection title={t("snapshot.title")} hint={t("snapshot.hint")} bodyClassName="space-y-4">
        <dl className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
          <div>
            <dt className="text-xs text-ink-600">{t("snapshot.source")}</dt>
            <dd className="mt-0.5">{t(`snapshot.sourceName.${snapshot.source}`)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-600">{t("snapshot.observed")}</dt>
            <dd className="num mt-0.5">{stamp(snapshot.observedAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-600">{t("snapshot.fetched")}</dt>
            <dd className="num mt-0.5">{stamp(snapshot.fetchedAt)}</dd>
          </div>
        </dl>

        {quotes.length === 0 ? (
          <p className="text-sm text-ink-600">{t("snapshot.empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[38rem] text-sm">
              <thead className="border-b border-ink-300/40 text-xs text-ink-600">
                <tr>
                  <th className="py-2 pe-4 text-start font-medium">{t("snapshot.col.pair")}</th>
                  <th className="py-2 pe-4 text-end font-medium">{t("snapshot.col.mid")}</th>
                  <th className="py-2 pe-4 text-start font-medium">{t("snapshot.col.change")}</th>
                  <th className="py-2 pe-4 text-start font-medium">{t("snapshot.col.source")}</th>
                  <th className="py-2 text-start font-medium">{t("snapshot.col.observed")}</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((quote) => (
                  <tr key={quote.pair} className="border-b border-ink-300/25 last:border-0">
                    <td className="py-2.5 pe-4 font-mono text-xs">
                      <span dir="ltr">{quote.pair}</span>
                    </td>
                    <td className="num py-2.5 pe-4 text-end">{formatRate(quote.mid, locale)}</td>
                    <td className="py-2.5 pe-4">
                      <ChangeChip pct={quote.changePct24h} locale={locale} />
                    </td>
                    <td className="py-2.5 pe-4 text-ink-600">
                      {t(`snapshot.sourceName.${quote.source}`)}
                    </td>
                    <td className="num py-2.5 text-ink-600">{stamp(quote.observedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PanelSection>

      <PanelSection title={t("sources.title")} hint={t("sources.hint")} bodyClassName="space-y-4">
        <p className="text-sm leading-relaxed text-ink-600">{t("sources.hint")}</p>
        {/* The switch is inert on purpose: `rate_sources` carries a select
              policy and no write policy at all, so an update would change
              nothing and report success. The two timestamp columns are dead in
              the same way — nothing writes `last_ok_at` or `last_error` yet —
              so they show the null placeholder instead of "never" and "no
              error", which an operator would read as a healthy provider. */}
        <p className="rounded-xl bg-info/12 p-3 text-sm leading-relaxed text-info-ink">
          {t("sources.readOnly")}
        </p>

        {sources.length === 0 ? (
          <p className="text-sm text-ink-600">{t("sources.empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[42rem] text-sm">
              <thead className="border-b border-ink-300/40 text-xs text-ink-600">
                <tr>
                  <th className="py-2 pe-4 text-start font-medium">{t("sources.col.name")}</th>
                  <th className="py-2 pe-4 text-start font-medium">{t("sources.col.kind")}</th>
                  <th className="py-2 pe-4 text-start font-medium">{t("sources.col.state")}</th>
                  <th className="py-2 pe-4 text-start font-medium">{t("sources.col.lastOk")}</th>
                  <th className="py-2 text-start font-medium">{t("sources.col.lastError")}</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((source) => (
                  <tr
                    key={source.id}
                    className="border-b border-ink-300/25 align-top last:border-0"
                  >
                    <td className="py-2.5 pe-4 font-medium">
                      {/* The direction belongs to the text: on the cell it would flip the
                          cell's own logical padding too, and the gap to the next
                          column with it. */}
                      <span dir="ltr">{source.name}</span>
                    </td>
                    <td className="py-2.5 pe-4 text-ink-600">{t(`sources.kind.${source.kind}`)}</td>
                    <td className="py-2.5 pe-4">
                      <span className="flex items-center gap-2">
                        <Switch checked={source.active} disabled aria-hidden />
                        <Badge variant={source.active ? "up" : "neutral"}>
                          {source.active ? t("sources.active") : t("sources.inactive")}
                        </Badge>
                      </span>
                    </td>
                    <td className="num py-2.5 pe-4 text-ink-600">
                      {source.last_ok_at ? stamp(source.last_ok_at) : "—"}
                    </td>
                    <td className="py-2.5 text-ink-600">
                      {source.last_error ? (
                        <span className="text-down" dir="ltr">
                          {source.last_error}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PanelSection>

      <PanelSection title={t("bounds.title")} hint={t("bounds.hint")} bodyClassName="space-y-3">
        <p className="text-sm leading-relaxed text-ink-600">{t("bounds.hint")}</p>
        {bounds === null ? (
          <p className="rounded-xl bg-info/12 p-3 text-sm leading-relaxed text-info-ink">
            {boundsStored ? t("bounds.unreadable") : t("bounds.missing")}
          </p>
        ) : null}

        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm font-medium">
            {t("bounds.floor")}
            <Input
              className="mt-1.5 w-32"
              dir="ltr"
              inputMode="numeric"
              value={floor}
              invalid={floorDraft === null}
              onChange={(e) => setFloor(e.target.value)}
            />
          </label>
          <label className="text-sm font-medium">
            {t("bounds.ceiling")}
            <Input
              className="mt-1.5 w-32"
              dir="ltr"
              inputMode="numeric"
              value={ceiling}
              invalid={ceilingDraft === null || ceilingDraft > MAX_SPREAD_BPS}
              onChange={(e) => setCeiling(e.target.value)}
            />
          </label>
          <Button disabled={busy || !valid} onClick={saveBounds}>
            <Save className="size-4" aria-hidden />
            {busy ? t("bounds.saving") : t("bounds.save")}
          </Button>
        </div>

        {floorDraft !== null && ceilingDraft !== null ? (
          <p className="text-xs text-ink-600">
            {means(floorDraft)} · {means(ceilingDraft)}
          </p>
        ) : null}
        {boundsUpdatedAt ? (
          <p className="text-xs text-ink-600">
            {t("bounds.updated", { at: stamp(boundsUpdatedAt) })}
          </p>
        ) : null}
      </PanelSection>

      <PanelSection
        title={t("spread.title")}
        hint={t("spread.hint")}
        href="/admin/exchanges"
        linkLabel={t("openOffices")}
        bodyClassName="space-y-4"
      >
        <p className="text-sm leading-relaxed text-ink-600">{t("spread.hint")}</p>
        {bounds === null && corridors.length > 0 ? (
          <p className="text-sm text-ink-600">{t("spread.notEnforced")}</p>
        ) : null}

        {corridors.length === 0 ? (
          <p className="text-sm text-ink-600">{t("spread.empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="border-b border-ink-300/40 text-xs text-ink-600">
                <tr>
                  <th className="py-2 pe-4 text-start font-medium">{t("spread.col.corridor")}</th>
                  <th className="py-2 pe-4 text-end font-medium">{t("spread.col.offices")}</th>
                  <th className="py-2 pe-4 text-start font-medium">{t("spread.col.min")}</th>
                  <th className="py-2 pe-4 text-end font-medium">{t("spread.col.median")}</th>
                  <th className="py-2 text-start font-medium">{t("spread.col.max")}</th>
                </tr>
              </thead>
              <tbody>
                {corridors.map((row) => {
                  // Flagged against what is stored, never against the draft in
                  // the fields above: the range in force is the one the quote
                  // is checked against, and an unsaved number is not it.
                  const below = bounds !== null && row.minBps < bounds.floor_bps;
                  const above = bounds !== null && row.maxBps > bounds.ceiling_bps;
                  return (
                    <tr
                      key={row.corridor}
                      className="border-b border-ink-300/25 align-top last:border-0"
                    >
                      <td className="py-2.5 pe-4 font-mono text-xs">
                        <span dir="ltr">{row.corridor}</span>
                      </td>
                      <td className="num py-2.5 pe-4 text-end text-ink-600">
                        {formatNumber(row.offices, locale)}
                      </td>
                      <td className="py-2.5 pe-4">
                        <span className="num">{formatNumber(row.minBps, locale)}</span>
                        {below ? (
                          <Badge variant="warn" className="ms-2">
                            {t("spread.belowFloor")}
                          </Badge>
                        ) : null}
                        <span className="mt-0.5 block text-xs text-ink-600">
                          {officeName(row.lowest)}
                        </span>
                      </td>
                      <td className="num py-2.5 pe-4 text-end">
                        {formatNumber(row.medianBps, locale)}
                      </td>
                      <td className="py-2.5">
                        <span className="num">{formatNumber(row.maxBps, locale)}</span>
                        {above ? (
                          <Badge variant="warn" className="ms-2">
                            {t("spread.aboveCeiling")}
                          </Badge>
                        ) : null}
                        <span className="mt-0.5 block text-xs text-ink-600">
                          {officeName(row.highest)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </PanelSection>

      {error ? (
        <p className="flex items-start gap-1.5 text-sm text-down">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}
      {note && !error ? <p className="text-sm text-up">{note}</p> : null}
    </div>
  );
}
