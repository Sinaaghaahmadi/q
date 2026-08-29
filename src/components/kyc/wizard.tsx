"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, CircleCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { EASE_IN } from "@/components/brand/scene";
import {
  DocumentScene,
  IdentityScene,
  LivenessScene,
  ReviewScene,
} from "@/components/brand/scenes/core";
import { LimitsScene } from "@/components/brand/scenes/banking";
import { ProgressRail } from "@/components/kyc/progress-rail";
import { DocumentReader, type DocumentFacts } from "@/components/kyc/document-reader";
import { UploadTile, type PreparedFile } from "@/components/kyc/upload-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRouter } from "@/i18n/navigation";
import {
  JALALI_MONTHS_FA,
  gregorianToJalali,
  jalaliMonthLength,
  jalaliToGregorian,
  toIsoDate,
} from "@/lib/date/jalali";
import { toLatinDigits, type AppLocale } from "@/lib/money/format";
import { createClient } from "@/lib/supabase/client";
import { validateNationalCode } from "@/lib/validators";
import { cn } from "@/lib/utils";

type DocKind = "national_id" | "passport";

interface Identity {
  fullNameFa: string;
  fullNameLatin: string;
  nationalCode: string;
  nationality: string;
  city: string;
  addressLine: string;
  postalCode: string;
}

const STEP_KEYS = ["identity", "document", "liveness", "review"] as const;
type StepKey = (typeof STEP_KEYS)[number];

const CURRENT_JY = gregorianToJalali(new Date()).jy;

export function KycWizard({
  initialName,
  initialStatus,
  ocrEnabled = false,
}: {
  initialName?: string | null;
  initialStatus?: string | null;
  /** `kyc.ocr` in `feature_flags`; the reader is not rendered without it. */
  ocrEnabled?: boolean;
}) {
  const t = useTranslations("kyc");
  const locale = useLocale() as AppLocale;
  const reduce = useReducedMotion();
  const router = useRouter();

  const [step, setStep] = React.useState(0);
  const [identity, setIdentity] = React.useState<Identity>({
    fullNameFa: initialName ?? "",
    fullNameLatin: "",
    nationalCode: "",
    nationality: "IR",
    city: "",
    addressLine: "",
    postalCode: "",
  });
  const [jy, setJy] = React.useState(CURRENT_JY - 30);
  const [jm, setJm] = React.useState(1);
  const [jd, setJd] = React.useState(1);

  const [docKind, setDocKind] = React.useState<DocKind>("national_id");
  const [front, setFront] = React.useState<PreparedFile | null>(null);
  const [back, setBack] = React.useState<PreparedFile | null>(null);
  const [selfie, setSelfie] = React.useState<PreparedFile | null>(null);

  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [submitted, setSubmitted] = React.useState(initialStatus === "pending");

  const isIranian = identity.nationality === "IR";
  const nationalCodeValid =
    !isIranian || validateNationalCode(toLatinDigits(identity.nationalCode));

  const identityComplete =
    identity.fullNameFa.trim().length > 2 &&
    identity.fullNameLatin.trim().length > 2 &&
    nationalCodeValid &&
    identity.city.trim().length > 1 &&
    identity.addressLine.trim().length > 4;

  const documentComplete = Boolean(front) && (docKind === "passport" || Boolean(back));
  const livenessComplete = Boolean(selfie);

  const canAdvance = [identityComplete, documentComplete, livenessComplete, true][step];

  /**
   * Take what the document says.
   *
   * Only ever called from the button in `DocumentReader`, never on a successful
   * read — the customer decides whether the passport or the form is right about
   * their own name, and a passport in a maiden name is a real thing that should
   * not silently overwrite what they typed.
   */
  const applyDocument = React.useCallback((facts: DocumentFacts) => {
    setIdentity((s) => ({
      ...s,
      fullNameLatin: facts.fullNameLatin,
      nationality: facts.nationality,
    }));
    setJy(facts.jy);
    setJm(facts.jm);
    setJd(facts.jd);
  }, []);

  const steps = STEP_KEYS.map((key) => ({ key, label: t(`steps.${key}.rail`) }));

  const dayCount = React.useMemo(() => jalaliMonthLength(jy, jm), [jy, jm]);
  React.useEffect(() => {
    if (jd > dayCount) setJd(dayCount);
  }, [dayCount, jd]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError(t("errors.signedOut"));
        return;
      }

      const dob = toIsoDate(jalaliToGregorian(jy, jm, jd));

      const { data: submission, error: insertError } = await supabase
        .from("kyc_submissions")
        .insert({
          user_id: user.id,
          status: "pending",
          data: {
            full_name_fa: identity.fullNameFa.trim(),
            full_name_latin: identity.fullNameLatin.trim(),
            national_code: toLatinDigits(identity.nationalCode),
            nationality: identity.nationality,
            dob,
            address: {
              city: identity.city.trim(),
              line: identity.addressLine.trim(),
              postal_code: toLatinDigits(identity.postalCode),
            },
            document_kind: docKind,
          },
        })
        .select("id")
        .single();

      if (insertError || !submission) {
        setError(t("errors.submitFailed"));
        return;
      }

      const uploads: { file: PreparedFile; kind: string }[] = [
        { file: front!, kind: docKind },
        ...(back ? [{ file: back, kind: docKind }] : []),
        { file: selfie!, kind: "selfie" },
      ];

      for (const [index, item] of uploads.entries()) {
        const path = `${user.id}/${submission.id}/${item.kind}-${index}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from("kyc-documents")
          .upload(path, item.file.blob, { contentType: "image/jpeg", upsert: true });
        if (uploadError) {
          setError(t("errors.uploadFailed"));
          return;
        }
        await supabase.from("kyc_documents").insert({
          submission_id: submission.id,
          kind: item.kind as "passport" | "national_id" | "selfie",
          storage_path: path,
          mime: "image/jpeg",
          sha256: item.file.sha256,
        });
      }

      await supabase
        .from("profiles")
        .update({
          full_name_fa: identity.fullNameFa.trim(),
          full_name_latin: identity.fullNameLatin.trim(),
          national_code: toLatinDigits(identity.nationalCode),
          nationality: identity.nationality,
          dob,
          kyc_status: "pending",
        })
        .eq("id", user.id);

      setSubmitted(true);
      setStep(3);
      router.refresh();
    } catch {
      setError(t("errors.network"));
    } finally {
      setBusy(false);
    }
  }

  const scene = [IdentityScene, DocumentScene, LivenessScene, ReviewScene][step]!;
  const SceneComponent = scene;
  const stepKey: StepKey = STEP_KEYS[step]!;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <ProgressRail steps={steps} current={submitted ? 3 : step} />

      <Card className="overflow-hidden">
        <div className="flex flex-col items-center gap-3 border-b border-ink-300/40 bg-canvas/60 px-6 py-6 text-center">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={stepKey}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -8 }}
              transition={reduce ? { duration: 0 } : { duration: 0.3, ease: EASE_IN }}
            >
              <SceneComponent size={120} label={t(`steps.${stepKey}.title`)} />
            </motion.div>
          </AnimatePresence>
          <div>
            <h2 className="text-lg font-bold">{t(`steps.${stepKey}.title`)}</h2>
            <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-ink-600">
              {submitted && step === 3 ? t("steps.review.pending") : t(`steps.${stepKey}.body`)}
            </p>
          </div>
        </div>

        <div className="space-y-5 p-6">
          {step === 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="kyc-name-fa"
                label={t("fields.nameFa")}
                value={identity.fullNameFa}
                onChange={(v) => setIdentity((s) => ({ ...s, fullNameFa: v }))}
                placeholder={t("fields.nameFaPlaceholder")}
              />
              <Field
                id="kyc-name-latin"
                label={t("fields.nameLatin")}
                value={identity.fullNameLatin}
                onChange={(v) => setIdentity((s) => ({ ...s, fullNameLatin: v }))}
                placeholder="Ali Rezaei"
                dir="ltr"
              />

              <div className="sm:col-span-2">
                <p className="text-sm font-medium">{t("fields.nationality")}</p>
                <Tabs
                  value={identity.nationality}
                  onValueChange={(v) => setIdentity((s) => ({ ...s, nationality: v }))}
                  className="mt-2"
                >
                  <TabsList>
                    <TabsTrigger value="IR">{t("fields.iranian")}</TabsTrigger>
                    <TabsTrigger value="OTHER">{t("fields.other")}</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {isIranian ? (
                <div className="sm:col-span-2">
                  <label htmlFor="kyc-nid" className="text-sm font-medium">
                    {t("fields.nationalCode")}
                  </label>
                  <Input
                    id="kyc-nid"
                    dir="ltr"
                    inputMode="numeric"
                    maxLength={10}
                    className="mt-2 text-start font-mono"
                    placeholder="0012345678"
                    value={identity.nationalCode}
                    invalid={identity.nationalCode.length === 10 && !nationalCodeValid}
                    onChange={(e) =>
                      setIdentity((s) => ({ ...s, nationalCode: e.target.value.slice(0, 12) }))
                    }
                  />
                  <p
                    className={cn(
                      "mt-1.5 text-xs",
                      identity.nationalCode.length === 10 && !nationalCodeValid
                        ? "text-down"
                        : "text-ink-600",
                    )}
                  >
                    {identity.nationalCode.length === 10 && !nationalCodeValid
                      ? t("fields.nationalCodeInvalid")
                      : t("fields.nationalCodeHint")}
                  </p>
                </div>
              ) : null}

              <div className="sm:col-span-2">
                <p className="text-sm font-medium">{t("fields.dob")}</p>
                <div className="mt-2 grid grid-cols-3 gap-2" dir={locale === "fa" ? "rtl" : "ltr"}>
                  <Select
                    label={t("fields.year")}
                    value={jy}
                    onChange={setJy}
                    options={Array.from({ length: 90 }, (_, i) => CURRENT_JY - 18 - i)}
                    format={(v) => String(v)}
                  />
                  <Select
                    label={t("fields.month")}
                    value={jm}
                    onChange={setJm}
                    options={Array.from({ length: 12 }, (_, i) => i + 1)}
                    format={(v) => (locale === "fa" ? JALALI_MONTHS_FA[v - 1]! : String(v))}
                  />
                  <Select
                    label={t("fields.day")}
                    value={jd}
                    onChange={setJd}
                    options={Array.from({ length: dayCount }, (_, i) => i + 1)}
                    format={(v) => String(v)}
                  />
                </div>
                <p className="mt-1.5 text-xs text-ink-600">{t("fields.dobHint")}</p>
              </div>

              <Field
                id="kyc-city"
                label={t("fields.city")}
                value={identity.city}
                onChange={(v) => setIdentity((s) => ({ ...s, city: v }))}
                placeholder={t("fields.cityPlaceholder")}
              />
              <Field
                id="kyc-postal"
                label={t("fields.postalCode")}
                value={identity.postalCode}
                onChange={(v) => setIdentity((s) => ({ ...s, postalCode: v }))}
                placeholder="1234567890"
                dir="ltr"
              />
              <div className="sm:col-span-2">
                <Field
                  id="kyc-address"
                  label={t("fields.address")}
                  value={identity.addressLine}
                  onChange={(v) => setIdentity((s) => ({ ...s, addressLine: v }))}
                  placeholder={t("fields.addressPlaceholder")}
                />
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-5">
              <Tabs value={docKind} onValueChange={(v) => setDocKind(v as DocKind)}>
                <TabsList>
                  <TabsTrigger value="national_id">{t("doc.nationalId")}</TabsTrigger>
                  <TabsTrigger value="passport">{t("doc.passport")}</TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="grid gap-5 sm:grid-cols-2">
                <UploadTile
                  id="kyc-front"
                  label={docKind === "passport" ? t("doc.passportPage") : t("doc.front")}
                  hint={t("doc.hint")}
                  capture="environment"
                  value={front}
                  onChange={setFront}
                />
                {docKind === "national_id" ? (
                  <UploadTile
                    id="kyc-back"
                    label={t("doc.back")}
                    hint={t("doc.hint")}
                    capture="environment"
                    value={back}
                    onChange={setBack}
                  />
                ) : null}
              </div>
              {ocrEnabled ? (
                <DocumentReader
                  file={front?.blob ?? null}
                  typed={{
                    fullNameLatin: identity.fullNameLatin,
                    nationality: identity.nationality,
                    jy,
                    jm,
                    jd,
                  }}
                  locale={locale}
                  onApply={applyDocument}
                />
              ) : null}

              <p className="text-xs leading-relaxed text-ink-600">{t("doc.privacy")}</p>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-5">
              <div className="mx-auto max-w-sm">
                <UploadTile
                  id="kyc-selfie"
                  label={t("liveness.label")}
                  hint={t("liveness.hint")}
                  capture="user"
                  value={selfie}
                  onChange={setSelfie}
                />
              </div>
              <ul className="mx-auto max-w-sm space-y-1.5 text-xs leading-relaxed text-ink-600">
                <li>• {t("liveness.tip1")}</li>
                <li>• {t("liveness.tip2")}</li>
                <li>• {t("liveness.tip3")}</li>
              </ul>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4 text-center">
              {submitted ? (
                <>
                  <Badge variant="warn" className="mx-auto">
                    {t("steps.review.badge")}
                  </Badge>
                  <p className="mx-auto max-w-md text-sm leading-relaxed text-ink-600">
                    {t("steps.review.next")}
                  </p>
                  {/* The reason any of this was asked for: the ceiling moves
                      once the review comes back. */}
                  <LimitsScene size={112} className="mx-auto" />
                </>
              ) : (
                <div className="space-y-3 text-start">
                  <SummaryRow label={t("fields.nameFa")} value={identity.fullNameFa} />
                  <SummaryRow
                    label={t("fields.nameLatin")}
                    value={identity.fullNameLatin}
                    dir="ltr"
                  />
                  {isIranian ? (
                    <SummaryRow
                      label={t("fields.nationalCode")}
                      value={`••••••${toLatinDigits(identity.nationalCode).slice(-4)}`}
                      dir="ltr"
                    />
                  ) : null}
                  <SummaryRow
                    label={t("fields.dob")}
                    value={
                      locale === "fa"
                        ? `${jd} ${JALALI_MONTHS_FA[jm - 1]} ${jy}`
                        : toIsoDate(jalaliToGregorian(jy, jm, jd))
                    }
                  />
                  <SummaryRow
                    label={t("doc.label")}
                    value={docKind === "passport" ? t("doc.passport") : t("doc.nationalId")}
                  />
                  <SummaryRow label={t("liveness.label")} value={t("upload.ok")} />
                </div>
              )}
            </div>
          ) : null}

          {error ? <p className="text-sm leading-relaxed text-down">{error}</p> : null}

          {!submitted ? (
            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-between">
              <Button
                variant="secondary"
                disabled={step === 0 || busy}
                onClick={() => setStep((s) => Math.max(0, s - 1))}
              >
                <ArrowLeft className="size-4 rtl:-scale-x-100" />
                {t("back")}
              </Button>
              {step < 3 ? (
                <Button disabled={!canAdvance || busy} onClick={() => setStep((s) => s + 1)}>
                  {t("next")}
                  <ArrowRight className="size-4 rtl:-scale-x-100" />
                </Button>
              ) : (
                <Button disabled={busy} onClick={submit}>
                  <CircleCheck className="size-4" />
                  {busy ? t("submitting") : t("submit")}
                </Button>
              )}
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  dir,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
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
        className={cn("mt-2", dir === "ltr" && "text-start")}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function Select<T extends number>({
  label,
  value,
  onChange,
  options,
  format,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: T[];
  format: (v: T) => string;
}) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value) as T)}
        className="h-11 w-full rounded-xl border border-ink-300 bg-surface px-3 text-sm text-ink-900 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/25 focus:outline-none"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {format(o)}
          </option>
        ))}
      </select>
    </label>
  );
}

function SummaryRow({ label, value, dir }: { label: string; value: string; dir?: "ltr" | "rtl" }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-ink-300/40 pb-2 text-sm last:border-0">
      <span className="text-ink-600">{label}</span>
      <span className="font-medium" dir={dir}>
        {value}
      </span>
    </div>
  );
}
