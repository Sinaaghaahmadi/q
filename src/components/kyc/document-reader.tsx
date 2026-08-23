"use client";

import { CircleAlert, ScanLine, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { gregorianToJalali } from "@/lib/date/jalali";
import type { MrzResult } from "@/lib/kyc/mrz";
import { formatDate, formatNumber, type AppLocale } from "@/lib/money/format";

/** What a successful read is allowed to write back into the form. */
export interface DocumentFacts {
  fullNameLatin: string;
  nationality: "IR" | "OTHER";
  jy: number;
  jm: number;
  jd: number;
}

interface Typed {
  fullNameLatin: string;
  nationality: string;
  jy: number;
  jm: number;
  jd: number;
}

/**
 * Reading the customer's own document back to them.
 *
 * The obvious use of this is saving typing, and it does that. The one worth
 * having is the other one: the machine-readable zone is what a border officer
 * reads, so when it disagrees with what somebody typed a moment ago, that
 * disagreement is worth showing *before* a compliance officer finds it three
 * days later and rejects the submission with no explanation the customer can
 * act on.
 *
 * So nothing is written silently. The reading is displayed, differences from
 * what they typed are called out, and one button applies it. A customer whose
 * passport is in a different name than the one they use every day — which
 * happens constantly — can simply not press it.
 *
 * Every field shown here has already passed its ICAO check digit; `readMrz`
 * returns nothing at all otherwise. There is no confidence score in this
 * component because there is no partially-trusted state to render.
 */
export function DocumentReader({
  file,
  typed,
  locale,
  onApply,
}: {
  file: Blob | null;
  typed: Typed;
  locale: AppLocale;
  onApply: (facts: DocumentFacts) => void;
}) {
  const t = useTranslations("kyc.ocr");

  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<MrzResult | null>(null);
  const [problem, setProblem] = React.useState<string | null>(null);
  const [applied, setApplied] = React.useState(false);

  // A new photograph invalidates the previous reading. Leaving it on screen
  // would attach one document's details to another document's image.
  React.useEffect(() => {
    setResult(null);
    setProblem(null);
    setApplied(false);
  }, [file]);

  async function read() {
    if (!file) return;
    setBusy(true);
    setProblem(null);
    // Loaded here rather than at the top of the file: the engine is five
    // megabytes, and a customer who types their own details never fetches it.
    const { readDocumentPhoto } = await import("@/lib/kyc/ocr");
    const outcome = await readDocumentPhoto(file);
    setBusy(false);
    if (outcome.ok) {
      setResult(outcome.document);
      return;
    }
    setProblem(t(`errors.${outcome.reason}`));
  }

  const facts = React.useMemo<DocumentFacts | null>(() => {
    if (!result) return null;
    const born = new Date(`${result.dateOfBirth}T00:00:00Z`);
    const { jy, jm, jd } = gregorianToJalali(born);
    return {
      fullNameLatin: [result.givenNames, result.surname].filter(Boolean).join(" "),
      nationality: result.nationality === "IRN" ? "IR" : "OTHER",
      jy,
      jm,
      jd,
    };
  }, [result]);

  const expired = result ? new Date(`${result.dateOfExpiry}T00:00:00Z`) < new Date() : false;

  const differs = React.useMemo(() => {
    if (!facts) return { name: false, dob: false, nationality: false };
    const normalise = (s: string) => s.trim().toUpperCase().replace(/\s+/g, " ");
    return {
      name:
        typed.fullNameLatin.trim().length > 0 &&
        normalise(typed.fullNameLatin) !== normalise(facts.fullNameLatin),
      dob: typed.jy !== facts.jy || typed.jm !== facts.jm || typed.jd !== facts.jd,
      nationality: typed.nationality !== facts.nationality,
    };
  }, [facts, typed]);

  const anyDifference = differs.name || differs.dob || differs.nationality;
  const plain = (n: number) => formatNumber(n, locale, { useGrouping: false });

  if (!file) return null;

  return (
    <div className="rounded-xl border border-ink-300/55 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <ScanLine className="size-4 shrink-0 text-brand-600" aria-hidden />
        <p className="flex-1 text-sm font-medium">{t("title")}</p>
        {result ? <Badge variant="up">{t("verified")}</Badge> : null}
      </div>

      <p className="mt-1.5 text-xs leading-relaxed text-ink-600">
        {result ? t("verifiedBody") : t("body")}
      </p>

      {!result ? (
        <Button variant="secondary" size="sm" className="mt-3" disabled={busy} onClick={read}>
          <ScanLine className="size-4" aria-hidden />
          {busy ? t("working") : t("read")}
        </Button>
      ) : null}

      {result && facts ? (
        <>
          <dl className="mt-3 grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
            <Row label={t("field.name")} value={facts.fullNameLatin} flagged={differs.name} ltr />
            <Row
              label={t("field.dob")}
              value={`${plain(facts.jy)}/${plain(facts.jm)}/${plain(facts.jd)}`}
              flagged={differs.dob}
            />
            <Row
              label={t("field.nationality")}
              value={result.nationality}
              flagged={differs.nationality}
              ltr
            />
            <Row label={t("field.number")} value={result.documentNumber} ltr />
          </dl>

          {expired ? (
            <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-warn/10 p-2.5 text-xs leading-relaxed text-warn-ink">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {/* The zone stores ISO; a Persian reader is shown the Persian
                  calendar, like every other date in the product. */}
              {t("expired", { date: formatDate(`${result.dateOfExpiry}T00:00:00Z`, locale) })}
            </p>
          ) : null}

          {anyDifference ? (
            <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-warn/10 p-2.5 text-xs leading-relaxed text-warn-ink">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {t("mismatch")}
            </p>
          ) : null}

          <Button
            size="sm"
            variant={anyDifference ? "primary" : "secondary"}
            className="mt-3"
            disabled={applied}
            onClick={() => {
              onApply(facts);
              setApplied(true);
            }}
          >
            {applied ? t("appliedLabel") : t("apply")}
          </Button>
        </>
      ) : null}

      {problem ? (
        <p className="mt-3 flex items-start gap-1.5 text-sm text-down">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {problem}
        </p>
      ) : null}
    </div>
  );
}

function Row({
  label,
  value,
  flagged = false,
  ltr = false,
}: {
  label: string;
  value: string;
  flagged?: boolean;
  ltr?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <dt className="text-xs text-ink-600">{label}</dt>
      <dd
        className={`m-0 font-medium ${flagged ? "text-warn-ink" : ""}`}
        dir={ltr ? "ltr" : undefined}
      >
        {value || "—"}
      </dd>
    </div>
  );
}
