"use client";

import { CircleAlert, MessageSquareWarning, Save, ShieldQuestion } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { THRESHOLD_KEYS } from "@/lib/admin/filters";
import { formatDate, formatNumber, type AppLocale } from "@/lib/money/format";
import { createClient } from "@/lib/supabase/client";
import type {
  ConversationKind,
  Json,
  Message,
  PlatformSetting,
  SanctionsHit,
  SupportSegment,
} from "@/lib/supabase/types";

/** The three signals `message_flags` raises today (§10); anything newer shows raw. */
const NAMED_FLAGS = new Set(["off_platform", "account_number", "contact"]);

export type SanctionsRow = SanctionsHit & {
  nameFa: string | null;
  nameLatin: string | null;
};

export type FlaggedMessage = Pick<
  Message,
  "id" | "conversation_id" | "body" | "flags" | "created_at"
> & {
  kind: ConversationKind | null;
  subjectId: string | null;
  segment: SupportSegment | null;
};

/**
 * §4.3 /admin/compliance: the four things a compliance officer asks about, on
 * one screen — who matched a sanctions list, which conversations tripped a
 * soft signal, what the AML ceilings currently are, and what the platform
 * keeps.
 *
 * The sanctions section deliberately does not render a reassuring empty state.
 * Nothing populates `sanctions_hits` yet (docs/security-review.md, item 4), so
 * an empty list means "not screened", and a screen that implied "clean" would
 * be the most expensive lie in the product.
 */
export function ComplianceView({
  hits,
  flagged,
  settings,
  canEditThresholds,
}: {
  hits: SanctionsRow[];
  flagged: FlaggedMessage[];
  settings: PlatformSetting[];
  canEditThresholds: boolean;
}) {
  const t = useTranslations("admin.compliance");
  const locale = useLocale() as AppLocale;
  const router = useRouter();

  const stored = new Map(settings.map((row) => [row.key, row]));

  const [drafts, setDrafts] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(settings.map((row) => [row.key, serialize(row.value)])),
  );
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<string | null>(null);

  async function save(row: PlatformSetting) {
    const value = parse(drafts[row.key] ?? "");
    if (value === undefined) return;
    setBusy(row.key);
    setError(null);
    setNote(null);
    const supabase = createClient();
    const { error: dbError } = await supabase.from("settings").update({ value }).eq("key", row.key);
    setBusy(null);
    if (dbError) {
      setError(t("thresholds.saveFailed"));
      return;
    }
    setNote(t("thresholds.saved"));
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("sanctions.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {hits.length === 0 ? (
            <div className="flex items-start gap-2.5 rounded-xl bg-warn/12 p-4 text-sm leading-relaxed text-warn-ink">
              <ShieldQuestion className="mt-0.5 size-5 shrink-0" aria-hidden />
              <div className="space-y-1.5">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {t("sanctions.gapTitle")}
                  <Badge variant="warn">{t("sanctions.gapBadge")}</Badge>
                </p>
                <p>{t("sanctions.gapBody")}</p>
              </div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[42rem] text-sm">
                  <thead className="border-b border-ink-300/40 text-xs text-ink-600">
                    <tr>
                      <th className="py-2 pe-4 text-start font-medium">
                        {t("sanctions.col.person")}
                      </th>
                      <th className="py-2 pe-4 text-start font-medium">
                        {t("sanctions.col.list")}
                      </th>
                      <th className="py-2 pe-4 text-start font-medium">
                        {t("sanctions.col.score")}
                      </th>
                      <th className="py-2 pe-4 text-start font-medium">
                        {t("sanctions.col.created")}
                      </th>
                      <th className="py-2 text-start font-medium">
                        {t("sanctions.col.resolution")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {hits.map((hit) => (
                      <tr
                        key={hit.id}
                        className="border-b border-ink-300/25 align-top last:border-0"
                      >
                        <td className="py-3 pe-4">
                          <p>
                            {(locale === "fa" ? hit.nameFa : hit.nameLatin) ??
                              hit.nameFa ??
                              hit.nameLatin ??
                              t("sanctions.unnamed")}
                          </p>
                          <details className="mt-1">
                            <summary className="cursor-pointer text-xs text-ink-600">
                              {t("sanctions.payload")}
                            </summary>
                            <pre
                              dir="ltr"
                              className="mt-1.5 max-h-40 overflow-auto rounded-xl bg-canvas p-3 font-mono text-[0.6875rem] leading-relaxed"
                            >
                              {JSON.stringify(hit.payload, null, 2)}
                            </pre>
                          </details>
                        </td>
                        <td className="py-3 pe-4 font-mono text-xs">
                          <span dir="ltr">{hit.list}</span>
                        </td>
                        <td className="py-3 pe-4 tabular-nums">
                          {formatNumber(Number(hit.match_score), locale, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="py-3 pe-4 text-ink-600 tabular-nums">
                          {formatDate(hit.created_at, locale, {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </td>
                        <td className="py-3">
                          {hit.resolution ? (
                            <span className="text-ink-600">{hit.resolution}</span>
                          ) : (
                            <Badge variant="warn">{t("sanctions.unresolved")}</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-ink-600">
                {t("sanctions.shown", { count: formatNumber(hits.length, locale) })}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("flags.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-ink-600">{t("flags.body")}</p>
          {flagged.length === 0 ? (
            <p className="text-sm text-ink-600">{t("flags.empty")}</p>
          ) : (
            <>
              <ol className="space-y-2">
                {flagged.map((message) => {
                  const href = threadHref(message);
                  return (
                    <li
                      key={message.id}
                      className="rounded-xl border border-ink-300/40 p-3.5 text-sm"
                    >
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                        <MessageSquareWarning
                          className="size-4 shrink-0 text-warn-ink"
                          aria-hidden
                        />
                        {raisedFlags(message.flags).map((flag) =>
                          NAMED_FLAGS.has(flag) ? (
                            <Badge key={flag} variant="warn">
                              {t(`flags.name.${flag}`)}
                            </Badge>
                          ) : (
                            <Badge key={flag} variant="outline" className="font-mono" dir="ltr">
                              {flag}
                            </Badge>
                          ),
                        )}
                        {message.kind ? (
                          <Badge variant="neutral">{t(`flags.kind.${message.kind}`)}</Badge>
                        ) : null}
                        <span className="flex-1" />
                        <time
                          dateTime={message.created_at}
                          className="shrink-0 text-xs text-ink-600 tabular-nums"
                        >
                          {formatDate(message.created_at, locale, {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </time>
                      </div>
                      <p className="mt-2 line-clamp-3 leading-relaxed text-ink-600">
                        {message.body?.trim() ? message.body : t("flags.noBody")}
                      </p>
                      {href ? (
                        <Link
                          href={href}
                          className="mt-2 inline-block text-sm font-medium text-brand-700 hover:underline dark:text-brand-600"
                        >
                          {t("flags.open")}
                        </Link>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
              <p className="text-xs text-ink-600">
                {t("flags.shown", { count: formatNumber(flagged.length, locale) })}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("thresholds.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-ink-600">{t("thresholds.body")}</p>
          {!canEditThresholds ? (
            <p className="flex items-start gap-1.5 rounded-xl bg-info/12 p-3 text-sm text-info-ink">
              {t("thresholds.readOnly")}
            </p>
          ) : null}

          {THRESHOLD_KEYS.map((key) => {
            const row = stored.get(key);
            const draft = drafts[key] ?? "";
            const parsed = parse(draft);
            return (
              <div key={key} className="space-y-2">
                <div>
                  <p className="text-sm font-medium">{t(`thresholds.keys.${key}.label`)}</p>
                  <p className="text-sm text-ink-600">{t(`thresholds.keys.${key}.hint`)}</p>
                </div>

                {row === undefined ? (
                  <p className="text-sm text-ink-600">{t("thresholds.missing")}</p>
                ) : canEditThresholds ? (
                  <>
                    <textarea
                      rows={8}
                      dir="ltr"
                      spellCheck={false}
                      aria-label={t("thresholds.editorLabel", { key })}
                      aria-invalid={parsed === undefined || undefined}
                      value={draft}
                      onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
                      className="w-full rounded-xl border border-ink-300 bg-canvas p-3 font-mono text-[0.6875rem] leading-relaxed focus:border-brand-600 focus:ring-2 focus:ring-brand-600/25 focus:outline-none"
                    />
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={
                          busy !== null || parsed === undefined || draft === serialize(row.value)
                        }
                        onClick={() => save(row)}
                      >
                        <Save className="size-4" aria-hidden />
                        {busy === key ? t("thresholds.saving") : t("thresholds.save")}
                      </Button>
                      {parsed === undefined ? (
                        <span className="text-sm text-down">{t("thresholds.invalid")}</span>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <pre
                    dir="ltr"
                    className="max-h-80 overflow-auto rounded-xl bg-canvas p-3 font-mono text-[0.6875rem] leading-relaxed"
                  >
                    {serialize(row.value)}
                  </pre>
                )}
              </div>
            );
          })}

          {error ? (
            <p className="flex items-start gap-1.5 text-sm text-down">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {error}
            </p>
          ) : null}
          {note && !error ? <p className="text-sm text-up">{note}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("retention.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm leading-relaxed text-ink-600">
          <p>{t("retention.body")}</p>
          <ul className="list-disc space-y-1.5 ps-5">
            <li>{t("retention.audit")}</li>
            <li>{t("retention.ledger")}</li>
            <li>{t("retention.kyc")}</li>
          </ul>
          <p className="flex items-start gap-1.5 rounded-xl bg-warn/12 p-3 text-warn-ink">
            {t("retention.gap")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Where the flagged message actually lives. An order thread has a page of its
 * own; a support thread only opens inside its own queue, so the segment has to
 * ride along. A p2p thread has no single destination yet, and an unreachable
 * link is worse than none.
 */
function threadHref(message: FlaggedMessage): string | null {
  if (message.kind === "order" && message.subjectId) return `/orders/${message.subjectId}`;
  if (message.kind === "support" && message.segment) {
    return `/admin/support?segment=${message.segment}&thread=${message.conversation_id}`;
  }
  return null;
}

function raisedFlags(flags: Json): string[] {
  if (flags === null || typeof flags !== "object" || Array.isArray(flags)) return [];
  return Object.entries(flags)
    .filter(([, value]) => value === true)
    .map(([name]) => name);
}

function serialize(value: Json): string {
  return JSON.stringify(value, null, 2);
}

/** `undefined` for text that is not JSON — `null` is itself a valid value here. */
function parse(text: string): Json | undefined {
  try {
    return JSON.parse(text) as Json;
  } catch {
    return undefined;
  }
}
