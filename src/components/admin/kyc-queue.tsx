"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CircleAlert, Eye, FileCheck2, ShieldQuestion, UserCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { EASE_IN } from "@/components/brand/scene";
import { ReviewScene } from "@/components/brand/scenes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Link } from "@/i18n/navigation";
import { formatDate, type AppLocale } from "@/lib/money/format";
import { createClient } from "@/lib/supabase/client";
import type { KycDocument, KycSubmission } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

export interface QueueRow extends KycSubmission {
  documents: KycDocument[];
}

const CHECKLIST = ["legible", "nameMatch", "notExpired", "selfieMatch", "noTamper"] as const;

export function KycQueue({ rows, reviewerId }: { rows: QueueRow[]; reviewerId: string }) {
  const t = useTranslations("adminKyc");
  const locale = useLocale() as AppLocale;
  const reduce = useReducedMotion();

  const [queue, setQueue] = React.useState(rows);
  const [active, setActive] = React.useState<QueueRow | null>(null);

  function remove(id: string) {
    setQueue((list) => list.filter((r) => r.id !== id));
    setActive(null);
  }

  return (
    <div className="space-y-5">
      {queue.length === 0 ? (
        <Card className="flex flex-col items-center gap-4 p-10 text-center">
          <ReviewScene size={130} label={t("emptyTitle")} />
          <div>
            <h2 className="text-lg font-semibold">{t("emptyTitle")}</h2>
            <p className="mt-1 text-sm text-ink-600">{t("emptyBody")}</p>
          </div>
        </Card>
      ) : (
        <Card className="divide-y divide-ink-300/40">
          <AnimatePresence initial={false}>
            {queue.map((row) => {
              const data = row.data as Record<string, string | undefined>;
              const awaitingSecond = Boolean(row.recommended_by);
              const isOwnRecommendation = row.recommended_by === reviewerId;
              return (
                <motion.div
                  key={row.id}
                  layout
                  exit={reduce ? undefined : { opacity: 0, height: 0 }}
                  transition={reduce ? undefined : { duration: 0.3, ease: EASE_IN }}
                  className="flex flex-wrap items-center gap-3 px-4 py-3.5"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 dark:text-brand-600">
                    <UserCheck className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    {/* The name opens the person's file. A reviewer deciding
                        whether to trust a document wants their order history
                        and their earlier submissions, and both are one page
                        away — which until now meant a search box. */}
                    <Link
                      href={`/admin/users/${row.user_id}`}
                      className="block truncate text-sm font-medium hover:text-brand-700 dark:hover:text-brand-600"
                    >
                      {data.full_name_fa || data.full_name_latin || t("unnamed")}
                    </Link>
                    <p className="num text-xs text-ink-600">
                      {formatDate(row.submitted_at, locale, { dateStyle: "medium" })} ·{" "}
                      {t("documentCount", { count: row.documents.length })}
                    </p>
                  </div>

                  {awaitingSecond ? (
                    <Badge variant={isOwnRecommendation ? "warn" : "info"}>
                      {isOwnRecommendation ? t("awaitingOther") : t("awaitingYou")}
                    </Badge>
                  ) : (
                    <Badge variant="neutral">{t("needsFirst")}</Badge>
                  )}

                  <Button variant="secondary" size="sm" onClick={() => setActive(row)}>
                    <Eye className="size-4" />
                    {t("review")}
                  </Button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </Card>
      )}

      <ReviewDialog
        row={active}
        reviewerId={reviewerId}
        onClose={() => setActive(null)}
        onDecided={remove}
      />
    </div>
  );
}

function ReviewDialog({
  row,
  reviewerId,
  onClose,
  onDecided,
}: {
  row: QueueRow | null;
  reviewerId: string;
  onClose: () => void;
  onDecided: (id: string) => void;
}) {
  const t = useTranslations("adminKyc");
  const locale = useLocale() as AppLocale;

  const [checks, setChecks] = React.useState<Record<string, boolean>>({});
  const [urls, setUrls] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [reason, setReason] = React.useState("");

  React.useEffect(() => {
    setChecks({});
    setUrls({});
    setError(null);
    setReason("");
  }, [row?.id]);

  async function openDocument(doc: KycDocument) {
    const res = await fetch(`/api/kyc/document?path=${encodeURIComponent(doc.storage_path)}`);
    if (!res.ok) {
      setError(t("errors.documentDenied"));
      return;
    }
    const payload = (await res.json()) as { url: string };
    setUrls((prev) => ({ ...prev, [doc.id]: payload.url }));
  }

  async function act(
    kind: "recommend" | "decide",
    decision: "approved" | "rejected" | "more_info_needed",
  ) {
    if (!row) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc(
        kind === "recommend" ? "kyc_recommend" : "kyc_decide",
        kind === "recommend"
          ? { p_submission: row.id, p_recommendation: decision, p_reason: reason || null }
          : { p_submission: row.id, p_decision: decision, p_reason: reason || null },
      );
      if (rpcError) {
        setError(
          /four-eyes/i.test(rpcError.message) ? t("errors.fourEyes") : t("errors.actionFailed"),
        );
        return;
      }
      onDecided(row.id);
    } catch {
      setError(t("errors.network"));
    } finally {
      setBusy(false);
    }
  }

  const allChecked = CHECKLIST.every((key) => checks[key]);
  const data = (row?.data ?? {}) as Record<string, string | undefined>;
  const awaitingSecond = Boolean(row?.recommended_by);
  const isOwnRecommendation = row?.recommended_by === reviewerId;

  return (
    <Dialog open={row !== null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent variant="sheet" className="p-0 sm:max-w-3xl">
        {row ? (
          <div className="space-y-5 overflow-y-auto p-5 pe-12">
            <div>
              <DialogTitle className="text-lg font-semibold">
                {data.full_name_fa || t("unnamed")}
              </DialogTitle>
              <p className="num mt-1 text-xs text-ink-600">
                {formatDate(row.submitted_at, locale, { dateStyle: "long" })}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Detail label={t("fields.nameLatin")} value={data.full_name_latin} dir="ltr" />
              <Detail
                label={t("fields.nationalCode")}
                value={data.national_code ? `••••••${data.national_code.slice(-4)}` : undefined}
                dir="ltr"
              />
              <Detail label={t("fields.dob")} value={data.dob} dir="ltr" />
              <Detail label={t("fields.nationality")} value={data.nationality} />
            </div>

            {/* Document viewer — signed URLs only, watermarked with the reviewer id */}
            <div>
              <p className="text-sm font-semibold">{t("documents")}</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-3">
                {row.documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="relative aspect-[8/5] overflow-hidden rounded-xl border border-ink-300/60 bg-canvas"
                  >
                    {urls[doc.id] ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
                        <img src={urls[doc.id]} alt="" className="size-full object-cover" />
                        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                          <span className="num -rotate-12 rounded bg-ink-900/55 px-2 py-1 font-mono text-[0.6rem] text-white">
                            {reviewerId.slice(0, 8)}
                          </span>
                        </span>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openDocument(doc)}
                        className="flex size-full flex-col items-center justify-center gap-1.5 text-xs text-ink-600 hover:bg-ink-300/10"
                      >
                        <FileCheck2 className="size-5" />
                        {t(`docKind.${doc.kind}`)}
                        <span className="text-[0.65rem]">{t("openDocument")}</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-ink-600">{t("documentsNote")}</p>
            </div>

            {/* Checklist */}
            <div>
              <p className="text-sm font-semibold">{t("checklist")}</p>
              <ul className="mt-2 space-y-1.5">
                {CHECKLIST.map((key) => (
                  <li key={key}>
                    <label className="flex items-start gap-2.5 text-sm">
                      <input
                        type="checkbox"
                        className="mt-0.5 size-4 accent-[var(--brand-600)]"
                        checked={Boolean(checks[key])}
                        onChange={(e) => setChecks((c) => ({ ...c, [key]: e.target.checked }))}
                      />
                      <span className="leading-relaxed text-ink-600">{t(`checks.${key}`)}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <label htmlFor="kyc-reason" className="text-sm font-semibold">
                {t("reason")}
              </label>
              <textarea
                id="kyc-reason"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t("reasonPlaceholder")}
                className="mt-2 w-full rounded-xl border border-ink-300 bg-surface p-3 text-sm focus:border-brand-600 focus:ring-2 focus:ring-brand-600/25 focus:outline-none"
              />
            </div>

            {error ? (
              <p className="flex items-start gap-1.5 text-sm text-down">
                <CircleAlert className="mt-0.5 size-4 shrink-0" />
                {error}
              </p>
            ) : null}

            <div
              className={cn(
                "rounded-xl border p-3 text-xs leading-relaxed",
                awaitingSecond
                  ? "border-info/40 bg-info/5 text-ink-600"
                  : "border-ink-300/60 text-ink-600",
              )}
            >
              <span className="inline-flex items-center gap-1.5 font-medium text-ink-900">
                <ShieldQuestion className="size-3.5" />
                {t("fourEyesTitle")}
              </span>
              <p className="mt-1">
                {awaitingSecond
                  ? isOwnRecommendation
                    ? t("fourEyesOwn")
                    : t("fourEyesSecond")
                  : t("fourEyesFirst")}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {!awaitingSecond ? (
                <>
                  <Button
                    disabled={!allChecked || busy}
                    onClick={() => act("recommend", "approved")}
                  >
                    {t("recommendApprove")}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={busy || !reason}
                    onClick={() => act("recommend", "more_info_needed")}
                  >
                    {t("recommendMoreInfo")}
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={busy || !reason}
                    onClick={() => act("recommend", "rejected")}
                  >
                    {t("recommendReject")}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    disabled={!allChecked || busy || isOwnRecommendation}
                    onClick={() => act("decide", "approved")}
                  >
                    {t("approve")}
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={busy || isOwnRecommendation || !reason}
                    onClick={() => act("decide", "rejected")}
                  >
                    {t("reject")}
                  </Button>
                </>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Detail({ label, value, dir }: { label: string; value?: string; dir?: "ltr" | "rtl" }) {
  return (
    <div className="rounded-xl border border-ink-300/50 p-3">
      <p className="text-xs text-ink-600">{label}</p>
      <p className="mt-0.5 text-sm font-medium" dir={dir}>
        {value || "—"}
      </p>
    </div>
  );
}
