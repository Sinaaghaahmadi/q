"use client";

import { CircleAlert, Plus, Save } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import * as React from "react";
import { RateSheetScene } from "@/components/brand/scenes/staff";
import { PanelSection } from "@/components/layout/panel-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InfoHint } from "@/components/ui/info-hint";
import { Switch } from "@/components/ui/switch";
import {
  formatAmount,
  formatAmountInput,
  formatNumber,
  parseAmountInput,
  toLatinDigits,
  type AppLocale,
} from "@/lib/money/format";
import { fromMinor, toMinor } from "@/lib/money/minor";
import { FOREIGN_CODES, isCurrencyCode, type CurrencyCode } from "@/lib/rates/catalog";
import { createClient } from "@/lib/supabase/client";
import type { Json, OfficeRateConfig } from "@/lib/supabase/types";

type Draft = { spread: string; min: string; max: string; cutoff: string };

/** Only the slice of `office_defaults()` this screen diffs against. */
type Defaults = { rate_config?: { corridor?: string; spread_bps?: number }[] };

/**
 * The office's own corridor terms (§4.2).
 *
 * Writes go straight at `office_rate_config`: `office_rate_config_manage`
 * already admits office_owner at this office, so an RPC in front of them would
 * decide nothing the policy has not. `canManage` only keeps the controls off an
 * operator's screen, whose UPDATE the database would refuse anyway.
 *
 * The spread is stored in basis points because pricing is, but nobody thinks in
 * basis points — so every field carries the percentage it works out to, right
 * where the number is typed. The template diff is the same one §16.2 shows the
 * platform, computed from the same `office_defaults()`, so the two screens can
 * never disagree about which corridor has been changed.
 */
export function RateConfigEditor({
  officeId,
  rates,
  defaults,
  canManage,
}: {
  officeId: string;
  rates: OfficeRateConfig[];
  defaults: Json | null;
  canManage: boolean;
}) {
  const t = useTranslations("officePanel.config");
  const locale = useLocale() as AppLocale;
  const router = useRouter();

  const template = ((defaults ?? {}) as Defaults).rate_config ?? [];
  const baseline = new Map(template.map((r) => [r.corridor ?? "", r.spread_bps ?? 0]));

  const [drafts, setDrafts] = React.useState<Record<string, Draft>>({});
  const [newCode, setNewCode] = React.useState<string>("USD");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<string | null>(null);

  function draftOf(row: OfficeRateConfig): Draft {
    return drafts[row.id] ?? initialDraft(row);
  }

  function patchDraft(row: OfficeRateConfig, part: Partial<Draft>) {
    setDrafts((d) => ({ ...d, [row.id]: { ...draftOf(row), ...part } }));
  }

  async function save(row: OfficeRateConfig) {
    const draft = draftOf(row);
    const code = baseOf(row.corridor);

    const spread = parseSpread(draft.spread);
    if (spread === null) {
      setError(t("rates.errors.spreadRange"));
      return;
    }

    const patch: Partial<OfficeRateConfig> = {
      spread_bps: spread,
      cutoff_time: draft.cutoff.trim() || null,
    };

    // A corridor whose foreign leg is outside the catalogue has no unit to read
    // an amount in, so both fields are disabled — and left out of the patch,
    // because writing the empty inputs back would erase what is on file.
    if (code !== null) {
      const min = minorOrNull(draft.min, code);
      const max = minorOrNull(draft.max, code);
      if (min === undefined || max === undefined) {
        setError(t("rates.errors.amountInvalid"));
        return;
      }
      if (min !== null && max !== null && min > max) {
        setError(t("rates.errors.amountOrder"));
        return;
      }
      patch.min_amount_minor = min;
      patch.max_amount_minor = max;
    }

    setBusy(row.id);
    setError(null);
    const supabase = createClient();
    const { data, error: dbError } = await supabase
      .from("office_rate_config")
      .update(patch)
      .eq("id", row.id)
      .select("id");
    setBusy(null);

    if (dbError) {
      setError(t("rates.errors.saveFailed"));
      return;
    }
    // A policy that refuses an UPDATE does not raise: it matches no row and
    // returns success. Asking for the row back is the only way to tell a
    // refusal from a save, and telling them apart is the whole point here.
    if ((data ?? []).length === 0) {
      setError(t("rates.errors.forbidden"));
      return;
    }
    setNote(t("rates.saved"));
    router.refresh();
  }

  async function setActive(row: OfficeRateConfig, active: boolean) {
    setBusy(row.id);
    setError(null);
    const supabase = createClient();
    const { data, error: dbError } = await supabase
      .from("office_rate_config")
      .update({ active })
      .eq("id", row.id)
      .select("id");
    setBusy(null);

    if (dbError || (data ?? []).length === 0) {
      setError(dbError ? t("rates.errors.saveFailed") : t("rates.errors.forbidden"));
      return;
    }
    router.refresh();
  }

  async function add() {
    const corridor = `${newCode}-IRT`;
    setBusy("new");
    setError(null);
    const supabase = createClient();
    const { error: dbError } = await supabase.from("office_rate_config").insert({
      office_id: officeId,
      corridor,
      spread_bps: baseline.get(corridor) ?? 0,
      // Off until someone has read the spread it landed on: `p2p_route_escrow`
      // picks the active office with the smallest spread, so a corridor the
      // template does not carry would go in at zero and outrank every other
      // office for that pair the moment it is written.
      active: false,
    });
    setBusy(null);

    if (dbError) {
      setError(
        dbError.code === "23505"
          ? t("rates.errors.duplicate")
          : dbError.code === "42501"
            ? t("rates.errors.forbidden")
            : t("rates.errors.saveFailed"),
      );
      return;
    }
    setNote(t("rates.saved"));
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-ink-600">{t("rates.templateNote")}</p>
      {!canManage ? <p className="text-sm text-ink-600">{t("rates.readOnly")}</p> : null}

      <PanelSection
        title={t("rates.listTitle")}
        hint={t("rates.listHint")}
        bodyClassName="space-y-4"
      >
        {rates.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <RateSheetScene size={120} />
            <p className="text-sm text-ink-600">
              {canManage ? t("rates.empty") : t("rates.emptyReadOnly")}
            </p>
          </div>
        ) : (
          rates.map((row) => {
            const draft = draftOf(row);
            const code = baseOf(row.corridor);
            const base = baseline.get(row.corridor);
            const spreadNow = parseSpread(draft.spread);

            return (
              <div key={row.id} className="space-y-3 rounded-xl border border-ink-300/55 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm" dir="ltr">
                    {row.corridor}
                  </span>
                  {base === undefined ? (
                    <Badge variant="outline">{t("rates.badge.custom")}</Badge>
                  ) : base === row.spread_bps ? (
                    <Badge variant="neutral">{t("rates.badge.same")}</Badge>
                  ) : (
                    <Badge variant="info">{t("rates.badge.overridden")}</Badge>
                  )}
                  {!row.active ? <Badge variant="warn">{t("rates.badge.inactive")}</Badge> : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="text-sm font-medium">
                    {/* The hint is a button, so it sits beside the label
                          rather than inside it: a click inside a `<label>`
                          also drives the field the label points at. */}
                    <span className="flex items-center gap-1.5">
                      <label htmlFor={`spread-${row.corridor}`}>{t("rates.spreadLabel")}</label>
                      <InfoHint term="rateMarkup" />
                    </span>
                    <Input
                      id={`spread-${row.corridor}`}
                      dir="ltr"
                      className="mt-1.5 text-start"
                      inputMode="numeric"
                      value={draft.spread}
                      disabled={!canManage}
                      onChange={(e) => patchDraft(row, { spread: e.target.value })}
                    />
                    <span className="mt-1 block text-xs font-normal text-ink-600">
                      {spreadNow !== null
                        ? t("rates.spreadMeans", {
                            bps: formatNumber(spreadNow, locale),
                            pct: formatNumber(spreadNow / 100, locale, {
                              minimumFractionDigits: 1,
                              maximumFractionDigits: 2,
                            }),
                          })
                        : t("rates.spreadHint")}
                    </span>
                    {base !== undefined ? (
                      <span className="mt-0.5 block text-xs font-normal text-ink-600">
                        {t("rates.templateSpread", { bps: formatNumber(base, locale) })}
                      </span>
                    ) : null}
                  </div>

                  <label className="block text-sm font-medium">
                    {t("rates.cutoffLabel")}
                    <Input
                      dir="ltr"
                      className="mt-1.5 text-start"
                      type="time"
                      value={draft.cutoff}
                      disabled={!canManage}
                      onChange={(e) => patchDraft(row, { cutoff: e.target.value })}
                    />
                    <span className="mt-1 block text-xs font-normal text-ink-600">
                      {t("rates.cutoffHint")}
                    </span>
                  </label>

                  <AmountField
                    label={t("rates.minLabel")}
                    hint={code ? t("rates.amountHint", { code }) : t("rates.amountUnknownCurrency")}
                    onFile={
                      row.min_amount_minor === null
                        ? t("rates.noLimit")
                        : code === null
                          ? undefined
                          : t("rates.onFile", {
                              amount: formatAmount(
                                fromMinor(row.min_amount_minor, code),
                                code,
                                locale,
                              ),
                              code,
                            })
                    }
                    value={draft.min}
                    disabled={!canManage || code === null}
                    onChange={(v) => patchDraft(row, { min: v })}
                  />
                  <AmountField
                    label={t("rates.maxLabel")}
                    hint={code ? t("rates.amountHint", { code }) : t("rates.amountUnknownCurrency")}
                    onFile={
                      row.max_amount_minor === null
                        ? t("rates.noLimit")
                        : code === null
                          ? undefined
                          : t("rates.onFile", {
                              amount: formatAmount(
                                fromMinor(row.max_amount_minor, code),
                                code,
                                locale,
                              ),
                              code,
                            })
                    }
                    value={draft.max}
                    disabled={!canManage || code === null}
                    onChange={(v) => patchDraft(row, { max: v })}
                  />
                </div>

                {canManage ? (
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                    <ToggleField
                      label={t("rates.activeLabel")}
                      hint={t("rates.activeHint")}
                      checked={row.active}
                      disabled={busy === row.id}
                      onChange={(v) => setActive(row, v)}
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      className="ms-auto"
                      disabled={busy === row.id || !dirty(draft, row)}
                      onClick={() => save(row)}
                    >
                      <Save className="size-4" aria-hidden />
                      {busy === row.id ? t("rates.working") : t("rates.save")}
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </PanelSection>

      {canManage ? (
        <PanelSection
          title={t("rates.addTitle")}
          hint={t("rates.addHint")}
          bodyClassName="space-y-3"
        >
          <p className="text-sm text-ink-600">{t("rates.addHint")}</p>
          <label className="block max-w-xs text-sm font-medium">
            {t("rates.addCurrency")}
            <select
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-xl border border-ink-300 bg-surface px-3 text-sm focus:border-brand-600 focus:ring-2 focus:ring-brand-600/25 focus:outline-none"
            >
              {FOREIGN_CODES.map((code) => (
                <option key={code} value={code}>
                  {code}-IRT
                </option>
              ))}
            </select>
          </label>
          <Button disabled={busy !== null} onClick={add}>
            <Plus className="size-4" aria-hidden />
            {busy === "new" ? t("rates.working") : t("rates.add")}
          </Button>
        </PanelSection>
      ) : null}

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

function AmountField({
  label,
  hint,
  onFile,
  value,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  onFile?: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <Input
        dir="ltr"
        className="mt-1.5 text-start tabular-nums"
        inputMode="decimal"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="mt-1 block text-xs font-normal text-ink-600">{hint}</span>
      {onFile ? (
        <span className="mt-0.5 block text-xs font-normal text-ink-600">{onFile}</span>
      ) : null}
    </label>
  );
}

function ToggleField({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  const hintId = React.useId();
  return (
    <span className="flex items-center gap-2.5">
      <Switch
        checked={checked}
        disabled={disabled}
        aria-label={label}
        aria-describedby={hintId}
        onCheckedChange={onChange}
      />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span id={hintId} className="block text-xs text-ink-600">
          {hint}
        </span>
      </span>
    </span>
  );
}

/**
 * The spread is read out of the string rather than coerced from it: `Number("")`
 * is 0, and clearing the field to retype is the ordinary gesture — one Save on
 * an empty box would put the corridor on zero margin. Persian digits are
 * accepted here because every other number on this screen accepts them.
 */
function parseSpread(raw: string): number | null {
  const digits = toLatinDigits(raw.trim());
  if (!/^\d{1,4}$/.test(digits)) return null;
  const value = Number(digits);
  return value <= 2000 ? value : null;
}

/** The foreign leg of a corridor — the currency its min/max are counted in. */
function baseOf(corridor: string): CurrencyCode | null {
  const base = corridor.split("-")[0] ?? "";
  return isCurrencyCode(base) ? base : null;
}

function initialDraft(row: OfficeRateConfig): Draft {
  const code = baseOf(row.corridor);
  return {
    spread: String(row.spread_bps),
    min:
      code && row.min_amount_minor !== null
        ? formatAmountInput(fromMinor(row.min_amount_minor, code))
        : "",
    max:
      code && row.max_amount_minor !== null
        ? formatAmountInput(fromMinor(row.max_amount_minor, code))
        : "",
    // Postgres hands `time` back as HH:MM:SS; the input wants HH:MM.
    cutoff: (row.cutoff_time ?? "").slice(0, 5),
  };
}

function dirty(draft: Draft, row: OfficeRateConfig): boolean {
  const initial = initialDraft(row);
  return (
    draft.spread !== initial.spread ||
    draft.min !== initial.min ||
    draft.max !== initial.max ||
    draft.cutoff !== initial.cutoff
  );
}

/** Empty is a deliberate "no limit"; `undefined` is the caller's error to report. */
function minorOrNull(raw: string, code: CurrencyCode): number | null | undefined {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const value = parseAmountInput(trimmed);
  if (value === null || value < 0) return undefined;
  try {
    return toMinor(value, code);
  } catch {
    return undefined;
  }
}
