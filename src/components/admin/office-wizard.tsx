"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CircleAlert, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import * as React from "react";
import { EASE_IN } from "@/components/brand/scene";
import { ProgressRail } from "@/components/kyc/progress-rail";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CURRENCY_CODES, type CurrencyCode } from "@/lib/rates/catalog";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/types";

const STEPS = ["legal", "corridors", "accounts", "review"] as const;
type Step = (typeof STEPS)[number];

const FOREIGN: CurrencyCode[] = CURRENCY_CODES.filter((c) => c !== "IRT");

type RateRow = { corridor: string; spreadBps: string };
type AccountRow = { currency: string; kind: string; label: string; detail: string };

type Defaults = { rate_config?: { corridor?: string; spread_bps?: number }[] };

/**
 * §16.1's wizard: legal details → corridors and default spreads → settlement
 * accounts → activate. It is one transaction at the end, not a save per screen,
 * because a half-provisioned office is worse than none: `admin_create_office`
 * either lands the office with its rates, accounts and balances or lands
 * nothing at all.
 *
 * Defaults arrive from `settings.office_defaults` so the diff §16.2 asks for
 * has a baseline that lives in one place.
 */
export function OfficeWizard({ defaults }: { defaults: Json | null }) {
  const t = useTranslations("admin.wizard");
  const router = useRouter();
  const reduce = useReducedMotion();

  const template = (defaults ?? {}) as Defaults;
  const [step, setStep] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [slug, setSlug] = React.useState("");
  const [nameFa, setNameFa] = React.useState("");
  const [nameEn, setNameEn] = React.useState("");
  const [licence, setLicence] = React.useState("");
  const [city, setCity] = React.useState("");
  const [reason, setReason] = React.useState("");

  const [rates, setRates] = React.useState<RateRow[]>(() =>
    (template.rate_config ?? []).map((r) => ({
      corridor: r.corridor ?? "",
      spreadBps: String(r.spread_bps ?? 0),
    })),
  );
  const [accounts, setAccounts] = React.useState<AccountRow[]>([
    { currency: "IRT", kind: "card", label: "", detail: "" },
  ]);

  const legalReady =
    /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug) &&
    nameFa.trim().length > 1 &&
    nameEn.trim().length > 1 &&
    licence.trim().length > 0;
  const corridorsReady =
    rates.length > 0 && rates.every((r) => /^[A-Z]{3}-[A-Z]{3}$/.test(r.corridor));
  // §16.1 ends at "activate", and admin_set_office_status refuses to activate an
  // office with nothing for customers to pay into. Ask for it here rather than
  // letting the last button fail.
  const accountsReady = accounts.some((a) => a.currency === "IRT" && a.detail.trim().length > 3);
  const ready = [legalReady, corridorsReady, accountsReady, legalReady][step] ?? false;

  async function provision(activate: boolean) {
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const payload = {
        slug: slug.trim().toLowerCase(),
        legal_name_fa: nameFa.trim(),
        legal_name_en: nameEn.trim(),
        license_no: licence.trim(),
        city: city.trim() || null,
        reason: reason.trim() || null,
        corridors: rates.map((r) => r.corridor),
        rate_config: rates.map((r) => ({
          corridor: r.corridor,
          spread_bps: Number(r.spreadBps) || 0,
        })),
        accounts: accounts
          .filter((a) => a.detail.trim().length > 0)
          .map((a) => ({
            currency: a.currency,
            kind: a.kind,
            label: a.label.trim() || null,
            is_public: true,
            details: { number: a.detail.trim() },
          })),
      };

      const { data: officeId, error: rpcError } = await supabase.rpc("admin_create_office", {
        p_office: payload as unknown as Json,
      });
      if (rpcError || !officeId) {
        setError(readable(rpcError?.message ?? ""));
        return;
      }

      if (activate) {
        const { error: statusError } = await supabase.rpc("admin_set_office_status", {
          p_office: officeId,
          p_status: "active",
          p_reason: reason.trim() || "provisioned and activated",
        });
        // The office exists either way; a refused activation is a fixable state,
        // not a failed provisioning, so say so and still navigate to it.
        if (statusError) setError(readable(statusError.message));
      }
      router.push(`/admin/exchanges/${officeId}`);
      router.refresh();
    } catch {
      setError(t("failed"));
    } finally {
      setBusy(false);
    }
  }

  function readable(raw: string): string {
    if (/duplicate key.*slug/i.test(raw)) return t("errors.slugTaken");
    if (/slug must be/i.test(raw)) return t("errors.slug");
    if (/legal names/i.test(raw)) return t("errors.names");
    if (/licence number|license number/i.test(raw)) return t("errors.licence");
    if (/only a platform administrator/i.test(raw)) return t("errors.forbidden");
    if (/without a public settlement account/i.test(raw)) return t("errors.noAccount");
    return t("failed");
  }

  const stepKey: Step = STEPS[step] ?? "legal";

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <ProgressRail
        steps={STEPS.map((key) => ({ key, label: t(`steps.${key}.title`) }))}
        current={step}
      />

      <Card className="overflow-hidden">
        <div className="border-b border-ink-300/40 bg-canvas/60 px-6 py-5">
          <h2 className="text-lg font-bold">{t(`steps.${stepKey}.title`)}</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-600">{t(`steps.${stepKey}.body`)}</p>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={stepKey}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={reduce ? undefined : { opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -8 }}
            transition={reduce ? undefined : { duration: 0.25, ease: EASE_IN }}
            className="space-y-5 p-6"
          >
            {stepKey === "legal" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="of-fa" label={t("fields.nameFa")} value={nameFa} onChange={setNameFa} />
                <Field
                  id="of-en"
                  label={t("fields.nameEn")}
                  value={nameEn}
                  onChange={setNameEn}
                  dir="ltr"
                />
                <Field
                  id="of-slug"
                  label={t("fields.slug")}
                  hint={t("fields.slugHint")}
                  value={slug}
                  onChange={(v) => setSlug(v.toLowerCase())}
                  dir="ltr"
                />
                <Field
                  id="of-lic"
                  label={t("fields.licence")}
                  value={licence}
                  onChange={setLicence}
                  dir="ltr"
                />
                <Field id="of-city" label={t("fields.city")} value={city} onChange={setCity} />
                <Field
                  id="of-reason"
                  label={t("fields.reason")}
                  value={reason}
                  onChange={setReason}
                />
              </div>
            ) : null}

            {stepKey === "corridors" ? (
              <div className="space-y-3">
                {rates.map((row, i) => (
                  <div key={i} className="flex items-end gap-2">
                    <label className="flex-1 text-sm font-medium">
                      {t("fields.corridor")}
                      <select
                        value={row.corridor}
                        onChange={(e) => updateRate(setRates, i, { corridor: e.target.value })}
                        className="mt-1.5 h-11 w-full rounded-xl border border-ink-300 bg-surface px-3 text-sm focus:border-brand-600 focus:ring-2 focus:ring-brand-600/25 focus:outline-none"
                      >
                        <option value="">—</option>
                        {FOREIGN.map((c) => (
                          <option key={c} value={`${c}-IRT`}>{`${c} → IRT`}</option>
                        ))}
                      </select>
                    </label>
                    <label className="w-32 text-sm font-medium">
                      {t("fields.spread")}
                      <Input
                        className="mt-1.5"
                        inputMode="numeric"
                        dir="ltr"
                        value={row.spreadBps}
                        onChange={(e) => updateRate(setRates, i, { spreadBps: e.target.value })}
                      />
                    </label>
                    <Button
                      variant="ghost"
                      aria-label={t("remove")}
                      onClick={() => setRates((rs) => rs.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="secondary"
                  onClick={() => setRates((rs) => [...rs, { corridor: "", spreadBps: "90" }])}
                >
                  <Plus className="size-4" aria-hidden />
                  {t("addCorridor")}
                </Button>
                <p className="text-sm text-ink-600">{t("spreadHint")}</p>
              </div>
            ) : null}

            {stepKey === "accounts" ? (
              <div className="space-y-3">
                {accounts.map((row, i) => (
                  <div
                    key={i}
                    className="grid gap-2 sm:grid-cols-[6rem_7rem_1fr_auto] sm:items-end"
                  >
                    <label className="text-sm font-medium">
                      {t("fields.currency")}
                      <select
                        value={row.currency}
                        onChange={(e) =>
                          updateAccount(setAccounts, i, { currency: e.target.value })
                        }
                        className="mt-1.5 h-11 w-full rounded-xl border border-ink-300 bg-surface px-3 text-sm focus:border-brand-600 focus:ring-2 focus:ring-brand-600/25 focus:outline-none"
                      >
                        {CURRENCY_CODES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm font-medium">
                      {t("fields.kind")}
                      <select
                        value={row.kind}
                        onChange={(e) => updateAccount(setAccounts, i, { kind: e.target.value })}
                        className="mt-1.5 h-11 w-full rounded-xl border border-ink-300 bg-surface px-3 text-sm focus:border-brand-600 focus:ring-2 focus:ring-brand-600/25 focus:outline-none"
                      >
                        {["card", "iban", "swift", "cash"].map((k) => (
                          <option key={k} value={k}>
                            {t(`kinds.${k}`)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm font-medium">
                      {t("fields.accountNumber")}
                      <Input
                        className="mt-1.5"
                        dir="ltr"
                        value={row.detail}
                        onChange={(e) => updateAccount(setAccounts, i, { detail: e.target.value })}
                      />
                    </label>
                    <Button
                      variant="ghost"
                      aria-label={t("remove")}
                      onClick={() => setAccounts((rs) => rs.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="secondary"
                  onClick={() =>
                    setAccounts((rs) => [
                      ...rs,
                      { currency: "USD", kind: "iban", label: "", detail: "" },
                    ])
                  }
                >
                  <Plus className="size-4" aria-hidden />
                  {t("addAccount")}
                </Button>
                <p className="text-sm text-ink-600">{t("accountHint")}</p>
              </div>
            ) : null}

            {stepKey === "review" ? (
              <dl className="space-y-2 text-sm">
                <Row label={t("fields.nameFa")} value={nameFa} />
                <Row label={t("fields.nameEn")} value={nameEn} />
                <Row label={t("fields.slug")} value={slug} />
                <Row label={t("fields.licence")} value={licence} />
                <Row label={t("fields.corridor")} value={rates.map((r) => r.corridor).join("، ")} />
                <Row
                  label={t("fields.accountNumber")}
                  value={accounts
                    .filter((a) => a.detail.trim())
                    .map((a) => `${a.currency} ${a.detail}`)
                    .join("، ")}
                />
              </dl>
            ) : null}

            {error ? (
              <p className="flex items-start gap-1.5 text-sm text-down">
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                {error}
              </p>
            ) : null}
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center justify-between gap-3 border-t border-ink-300/40 px-6 py-4">
          <Button
            variant="ghost"
            disabled={step === 0 || busy}
            onClick={() => setStep((s) => s - 1)}
          >
            {t("back")}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button disabled={!ready || busy} onClick={() => setStep((s) => s + 1)}>
              {t("next")}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="secondary" disabled={busy} onClick={() => provision(false)}>
                {t("saveDraft")}
              </Button>
              <Button disabled={busy} onClick={() => provision(true)}>
                {busy ? t("working") : t("activate")}
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function updateRate(
  set: React.Dispatch<React.SetStateAction<RateRow[]>>,
  index: number,
  patch: Partial<RateRow>,
) {
  set((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
}

function updateAccount(
  set: React.Dispatch<React.SetStateAction<AccountRow[]>>,
  index: number,
  patch: Partial<AccountRow>,
) {
  set((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
}

function Field({
  id,
  label,
  hint,
  value,
  onChange,
  dir,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  dir?: "ltr" | "rtl";
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Input
        id={id}
        dir={dir}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5"
      />
      {hint ? <p className="mt-1 text-xs text-ink-600">{hint}</p> : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-ink-300/40 pb-2 last:border-0">
      <dt className="text-ink-600">{label}</dt>
      <dd className="text-end font-medium">{value || "—"}</dd>
    </div>
  );
}
