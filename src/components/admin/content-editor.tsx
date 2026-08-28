"use client";

import { CircleAlert, Eye, EyeOff, Languages, Plus, Save } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import * as React from "react";
import { PanelSection } from "@/components/layout/panel-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, type AppLocale } from "@/lib/money/format";
import { createClient } from "@/lib/supabase/client";
import type { CmsContent, Json, NotificationTemplate } from "@/lib/supabase/types";

type CmsType = CmsContent["type"];
type Channel = NotificationTemplate["channel"];

/** The two languages the platform ships in; a key is finished only in both. */
const LOCALES = ["fa", "en"] as const;
type Lang = (typeof LOCALES)[number];

const CMS_TYPES: CmsType[] = ["page", "faq", "banner", "announcement"];

const FIELD =
  "mt-1.5 w-full rounded-xl border border-ink-300 bg-surface px-3 py-2.5 text-sm focus:border-brand-600 focus:ring-2 focus:ring-brand-600/25 focus:outline-none";
const SELECT = `${FIELD} h-11 py-0`;
const BODY = `${FIELD} font-mono leading-relaxed`;

/**
 * §4.3, §16.7 — the CMS: site content and the notification wording, both
 * languages of both on one screen.
 *
 * Grouped by key rather than listed by row, because the question this screen
 * exists to answer is "is this thing written in both languages". A flat list
 * sorted by date can look entirely healthy while half the platform has no
 * English, and that half-translated state is what reaches a customer as a raw
 * key or a blank page.
 *
 * Nothing here deletes: `t_cms_content_no_delete` refuses it at the table, so
 * publish/unpublish is the only retirement control there is. Note that no
 * route reads `cms_content` yet — the flag marks a row ready, it does not put
 * it on the site — and the copy on the screen says so rather than letting an
 * operator believe a page changed.
 */
export function ContentEditor({
  cms,
  templates,
}: {
  cms: CmsContent[];
  templates: NotificationTemplate[];
}) {
  const t = useTranslations("admin.content");

  return (
    <Tabs defaultValue="cms">
      <TabsList>
        <TabsTrigger value="cms">{t("tab.cms")}</TabsTrigger>
        <TabsTrigger value="templates">{t("tab.templates")}</TabsTrigger>
      </TabsList>

      <TabsContent value="cms">
        <PanelSection
          title={t("tab.cms")}
          hint={t("tab.cmsHint")}
          bodyClassName="space-y-4"
          className="mt-4"
        >
          <CmsSection rows={cms} />
        </PanelSection>
      </TabsContent>
      <TabsContent value="templates">
        <PanelSection
          title={t("tab.templates")}
          hint={t("tab.templatesHint")}
          bodyClassName="space-y-4"
          className="mt-4"
        >
          <TemplateSection rows={templates} />
        </PanelSection>
      </TabsContent>
    </Tabs>
  );
}

function CmsSection({ rows }: { rows: CmsContent[] }) {
  const t = useTranslations("admin.content");
  const [creating, setCreating] = React.useState(false);

  const groups = groupBy(rows, (row) => row.key);
  const gaps = [...groups.values()].filter((group) => missingLocales(group).length > 0).length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-600">{t("cms.noDelete")}</p>

      {gaps > 0 ? (
        <p className="flex items-start gap-2 rounded-xl bg-warn/12 p-3 text-sm text-warn-ink">
          <Languages className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t("cms.gapWarning", { count: gaps })}
        </p>
      ) : rows.length > 0 ? (
        <p className="text-sm text-ink-600">{t("cms.allTranslated")}</p>
      ) : null}

      <div>
        <Button variant="secondary" onClick={() => setCreating((open) => !open)}>
          <Plus className="size-4" aria-hidden />
          {t("cms.newKey")}
        </Button>
      </div>

      {creating ? (
        <Card className="p-5">
          <CmsForm seed={{}} onDone={() => setCreating(false)} />
        </Card>
      ) : null}

      {rows.length === 0 ? (
        <Card className="p-10 text-center text-sm text-ink-600">{t("cms.empty")}</Card>
      ) : (
        [...groups].map(([key, group]) => <CmsKeyCard key={key} contentKey={key} rows={group} />)
      )}
    </div>
  );
}

function CmsKeyCard({ contentKey, rows }: { contentKey: string; rows: CmsContent[] }) {
  const t = useTranslations("admin.content");
  const [adding, setAdding] = React.useState<Lang | null>(null);

  // Every locale of one key describes the same thing, so the first row's type
  // is the key's type; a new translation inherits it rather than asking again.
  const type = rows[0]?.type ?? "page";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-mono text-sm" dir="ltr">
          {contentKey}
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="neutral">{t(`cms.type.${type}`)}</Badge>
          {LOCALES.map((lang) => {
            const row = rows.find((r) => r.locale === lang);
            if (!row) {
              return (
                <Badge key={lang} variant="warn">
                  {t("cms.missing", { locale: t(`locale.${lang}`) })}
                </Badge>
              );
            }
            return (
              <Badge key={lang} variant={row.published_at ? "up" : "neutral"}>
                {t(`locale.${lang}`)} · {row.published_at ? t("cms.published") : t("cms.draft")}
              </Badge>
            );
          })}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {LOCALES.map((lang) => {
          const row = rows.find((r) => r.locale === lang);
          if (row) return <CmsRow key={lang} row={row} />;

          return (
            <div key={lang} className="rounded-xl border border-warn/40 bg-warn/12 p-4">
              {adding === lang ? (
                <CmsForm
                  seed={{ key: contentKey, type, locale: lang }}
                  onDone={() => setAdding(null)}
                />
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-warn-ink">
                    {t("cms.missing", { locale: t(`locale.${lang}`) })}
                  </p>
                  <Button variant="secondary" size="sm" onClick={() => setAdding(lang)}>
                    <Plus className="size-4" aria-hidden />
                    {t("cms.addTranslation", { locale: t(`locale.${lang}`) })}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function CmsRow({ row }: { row: CmsContent }) {
  const t = useTranslations("admin.content");
  const locale = useLocale() as AppLocale;
  const router = useRouter();

  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState(row.title);
  const [body, setBody] = React.useState(row.body);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<string | null>(null);

  async function save() {
    if (!title.trim()) {
      setError(t("errors.titleRequired"));
      return;
    }
    if (!body.trim()) {
      setError(t("errors.bodyRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    setNote(null);
    const supabase = createClient();
    const { data, error: dbError } = await supabase
      .from("cms_content")
      .update({ title: title.trim(), body })
      .eq("id", row.id)
      .select("id");
    setBusy(false);
    if (dbError || (data ?? []).length === 0) {
      setError(t(`errors.${writeFailure(dbError?.message)}`));
      return;
    }
    setNote(t("saved"));
    router.refresh();
  }

  async function setPublished(next: boolean) {
    setBusy(true);
    setError(null);
    setNote(null);
    const supabase = createClient();
    const { data, error: dbError } = await supabase
      .from("cms_content")
      .update({ published_at: next ? new Date().toISOString() : null })
      .eq("id", row.id)
      .select("id");
    setBusy(false);
    if (dbError || (data ?? []).length === 0) {
      setError(t(`errors.${writeFailure(dbError?.message)}`));
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-ink-300/55 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">{t(`locale.${row.locale}`)}</p>
          <p className="text-xs text-ink-600">
            {row.published_at
              ? t("cms.publishedOn", { date: formatDate(row.published_at, locale) })
              : t("cms.updatedOn", { date: formatDate(row.updated_at, locale) })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
            {open ? t("close") : t("edit")}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => setPublished(row.published_at === null)}
          >
            {row.published_at ? (
              <EyeOff className="size-4" aria-hidden />
            ) : (
              <Eye className="size-4" aria-hidden />
            )}
            {row.published_at ? t("cms.unpublish") : t("cms.publish")}
          </Button>
        </div>
      </div>

      {open ? (
        <div className="mt-3 space-y-3">
          <label className="block text-sm font-medium">
            {t("cms.titleLabel")}
            <Input
              className="mt-1.5"
              dir={dirOf(row.locale)}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="block text-sm font-medium">
            {t("cms.bodyLabel")}
            {/* The body's own language decides its direction, not the operator's
                UI language: an English page edited by a Persian admin is still
                English text. */}
            <textarea
              rows={12}
              dir={dirOf(row.locale)}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className={BODY}
            />
          </label>
          <p className="text-xs text-ink-600">{t("cms.bodyHint")}</p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={save}>
              <Save className="size-4" aria-hidden />
              {busy ? t("working") : t("save")}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setTitle(row.title);
                setBody(row.body);
                setOpen(false);
              }}
            >
              {t("cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-2 line-clamp-2 text-sm text-ink-600" dir={dirOf(row.locale)}>
          {row.title}
        </p>
      )}

      <Feedback error={error} note={note} />
    </div>
  );
}

/**
 * One form for both doors into `cms_content`: a brand-new key, and the second
 * language of a key that already exists. When the key, type and locale are
 * settled the form states them instead of offering them, so an added
 * translation cannot drift onto a different key by a stray keystroke.
 */
function CmsForm({
  seed,
  onDone,
}: {
  seed: { key?: string; type?: CmsType; locale?: Lang };
  onDone: () => void;
}) {
  const t = useTranslations("admin.content");
  const router = useRouter();

  const [key, setKey] = React.useState(seed.key ?? "");
  const [type, setType] = React.useState<CmsType>(seed.type ?? "page");
  const [lang, setLang] = React.useState<Lang>(seed.locale ?? "fa");
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function create() {
    const trimmed = key.trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(trimmed)) {
      setError(t("errors.keyRequired"));
      return;
    }
    if (!title.trim()) {
      setError(t("errors.titleRequired"));
      return;
    }
    if (!body.trim()) {
      setError(t("errors.bodyRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = createClient();
    // `published_at` is left at its default null: content arrives as a draft,
    // and putting it on the site is a second, deliberate press.
    const { error: dbError } = await supabase
      .from("cms_content")
      .insert({ key: trimmed, locale: lang, type, title: title.trim(), body })
      .select("id");
    setBusy(false);
    if (dbError) {
      setError(t(`errors.${writeFailure(dbError.message)}`));
      return;
    }
    onDone();
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {seed.key ? (
        <p className="font-mono text-sm" dir="ltr">
          {seed.key}
        </p>
      ) : (
        <label className="block text-sm font-medium">
          {t("cms.keyLabel")}
          <Input
            className="mt-1.5"
            dir="ltr"
            value={key}
            placeholder={t("cms.keyPlaceholder")}
            onChange={(e) => setKey(e.target.value)}
          />
          <span className="mt-1 block text-xs font-normal text-ink-600">{t("cms.keyHint")}</span>
        </label>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {seed.type ? null : (
          <label className="block text-sm font-medium">
            {t("cms.typeLabel")}
            <select
              value={type}
              onChange={(e) => setType(e.target.value as CmsType)}
              className={SELECT}
            >
              {CMS_TYPES.map((option) => (
                <option key={option} value={option}>
                  {t(`cms.type.${option}`)}
                </option>
              ))}
            </select>
          </label>
        )}
        {seed.locale ? null : (
          <label className="block text-sm font-medium">
            {t("cms.localeLabel")}
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as Lang)}
              className={SELECT}
            >
              {LOCALES.map((option) => (
                <option key={option} value={option}>
                  {t(`locale.${option}`)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <label className="block text-sm font-medium">
        {t("cms.titleLabel")}
        <Input
          className="mt-1.5"
          dir={dirOf(lang)}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>

      <label className="block text-sm font-medium">
        {t("cms.bodyLabel")}
        <textarea
          rows={10}
          dir={dirOf(lang)}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className={BODY}
        />
      </label>
      <p className="text-xs text-ink-600">{t("cms.draftNote")}</p>

      <div className="flex flex-wrap gap-2">
        <Button disabled={busy} onClick={create}>
          <Save className="size-4" aria-hidden />
          {busy ? t("working") : t("create")}
        </Button>
        <Button variant="ghost" onClick={onDone}>
          {t("cancel")}
        </Button>
      </div>

      <Feedback error={error} note={null} />
    </div>
  );
}

function TemplateSection({ rows }: { rows: NotificationTemplate[] }) {
  const t = useTranslations("admin.content");

  const groups = groupBy(rows, (row) => row.key);
  // A template is a key *and* a channel: the SMS and the email of one event
  // are separate wordings, and either can be missing its second language.
  const gaps = [...groups.values()]
    .flatMap((group) => [...groupBy(group, (row) => row.channel).values()])
    .filter((group) => missingLocales(group).length > 0).length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-600">{t("templates.intro")}</p>

      {gaps > 0 ? (
        <p className="flex items-start gap-2 rounded-xl bg-warn/12 p-3 text-sm text-warn-ink">
          <Languages className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t("templates.gapWarning", { count: gaps })}
        </p>
      ) : rows.length > 0 ? (
        <p className="text-sm text-ink-600">{t("templates.allTranslated")}</p>
      ) : null}

      {rows.length === 0 ? (
        <Card className="p-10 text-center text-sm text-ink-600">{t("templates.empty")}</Card>
      ) : (
        [...groups].map(([key, group]) => (
          <TemplateKeyCard key={key} templateKey={key} rows={group} />
        ))
      )}
    </div>
  );
}

function TemplateKeyCard({
  templateKey,
  rows,
}: {
  templateKey: string;
  rows: NotificationTemplate[];
}) {
  const t = useTranslations("admin.content");
  const channels = groupBy(rows, (row) => row.channel);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-mono text-sm" dir="ltr">
          {templateKey}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {[...channels].map(([channel, group]) => (
          <section key={channel} className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info">{t(`templates.channel.${channel}`)}</Badge>
              {missingLocales(group).map((lang) => (
                <Badge key={lang} variant="warn">
                  {t("templates.missing", { locale: t(`locale.${lang}`) })}
                </Badge>
              ))}
            </div>

            {LOCALES.map((lang) => {
              const row = group.find((r) => r.locale === lang);
              if (row) return <TemplateRow key={lang} row={row} />;

              // The sibling language already declares the variables this event
              // hands the template; carrying them over keeps the two wordings
              // describing the same message.
              const sibling = group[0];
              return (
                <TemplateForm
                  key={lang}
                  templateKey={templateKey}
                  channel={channel}
                  lang={lang}
                  variables={sibling?.variables ?? []}
                />
              );
            })}
          </section>
        ))}
      </CardContent>
    </Card>
  );
}

function TemplateRow({ row }: { row: NotificationTemplate }) {
  const t = useTranslations("admin.content");
  const router = useRouter();

  const [open, setOpen] = React.useState(false);
  const [subject, setSubject] = React.useState(row.subject ?? "");
  const [body, setBody] = React.useState(row.body);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<string | null>(null);

  const variables = declaredVariables(row.variables);

  async function save() {
    if (!body.trim()) {
      setError(t("errors.bodyRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    setNote(null);
    const supabase = createClient();
    const { data, error: dbError } = await supabase
      .from("notification_templates")
      .update({ subject: subject.trim() || null, body })
      .eq("id", row.id)
      .select("id");
    setBusy(false);
    if (dbError || (data ?? []).length === 0) {
      setError(t(`errors.${writeFailure(dbError?.message)}`));
      return;
    }
    setNote(t("saved"));
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-ink-300/55 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{t(`locale.${row.locale}`)}</p>
        <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? t("close") : t("edit")}
        </Button>
      </div>

      <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,1fr)_14rem]">
        <div className="min-w-0 space-y-3">
          {open ? (
            <>
              <label className="block text-sm font-medium">
                {t("templates.subjectLabel")}
                <Input
                  className="mt-1.5"
                  dir={dirOf(row.locale)}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
                <span className="mt-1 block text-xs font-normal text-ink-600">
                  {t("templates.subjectHint")}
                </span>
              </label>
              <label className="block text-sm font-medium">
                {t("templates.bodyLabel")}
                <textarea
                  rows={6}
                  dir={dirOf(row.locale)}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className={BODY}
                />
                <span className="mt-1 block text-xs font-normal text-ink-600">
                  {t("templates.bodyHint")}
                </span>
              </label>
              <div className="flex flex-wrap gap-2">
                <Button disabled={busy} onClick={save}>
                  <Save className="size-4" aria-hidden />
                  {busy ? t("working") : t("save")}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSubject(row.subject ?? "");
                    setBody(row.body);
                    setOpen(false);
                  }}
                >
                  {t("cancel")}
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-ink-600" dir={dirOf(row.locale)}>
              {row.subject ?? t("templates.noSubject")}
            </p>
          )}

          <Preview body={body} variables={variables} locale={row.locale} />
        </div>

        <VariableList variables={variables} />
      </div>

      <Feedback error={error} note={note} />
    </div>
  );
}

/**
 * The missing half of a template pair. There is no "create a new key" here on
 * purpose — a key belongs to the code that will send the message, so one
 * invented on this screen would never be reached. No sender reads this table
 * yet at all; the row is still refused when the body is empty, so that
 * whichever sender arrives first cannot inherit a blank SMS.
 */
function TemplateForm({
  templateKey,
  channel,
  lang,
  variables,
}: {
  templateKey: string;
  channel: Channel;
  lang: Lang;
  variables: Json;
}) {
  const t = useTranslations("admin.content");
  const router = useRouter();

  const [open, setOpen] = React.useState(false);
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const declared = declaredVariables(variables);

  async function create() {
    if (!body.trim()) {
      setError(t("errors.bodyRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: dbError } = await supabase
      .from("notification_templates")
      .insert({
        key: templateKey,
        locale: lang,
        channel,
        subject: subject.trim() || null,
        body,
        variables,
      })
      .select("id");
    setBusy(false);
    if (dbError) {
      setError(t(`errors.${writeFailure(dbError.message)}`));
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-warn/40 bg-warn/12 p-4">
        <p className="text-sm text-warn-ink">
          {t("templates.missing", { locale: t(`locale.${lang}`) })}
        </p>
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          <Plus className="size-4" aria-hidden />
          {t("templates.addTranslation", { locale: t(`locale.${lang}`) })}
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-ink-300/55 p-4">
      <p className="text-sm font-medium">{t(`locale.${lang}`)}</p>
      <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,1fr)_14rem]">
        <div className="min-w-0 space-y-3">
          <label className="block text-sm font-medium">
            {t("templates.subjectLabel")}
            <Input
              className="mt-1.5"
              dir={dirOf(lang)}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
            <span className="mt-1 block text-xs font-normal text-ink-600">
              {t("templates.subjectHint")}
            </span>
          </label>
          <label className="block text-sm font-medium">
            {t("templates.bodyLabel")}
            <textarea
              rows={6}
              dir={dirOf(lang)}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className={BODY}
            />
            <span className="mt-1 block text-xs font-normal text-ink-600">
              {t("templates.bodyHint")}
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={create}>
              <Save className="size-4" aria-hidden />
              {busy ? t("working") : t("create")}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
          </div>
          <Preview body={body} variables={declared} locale={lang} />
        </div>

        <VariableList variables={declared} />
      </div>

      <Feedback error={error} note={null} />
    </div>
  );
}

/**
 * What the message looks like with its variables named rather than filled. It
 * deliberately stops there: a send-test that no provider actually delivers
 * would be a green tick standing in for a message nobody received.
 */
function Preview({
  body,
  variables,
  locale,
}: {
  body: string;
  variables: string[];
  locale: string;
}) {
  const t = useTranslations("admin.content");
  const uiLocale = useLocale() as AppLocale;
  const stray = undeclaredIn(body, variables);

  return (
    <div className="space-y-2">
      <div className="rounded-xl bg-canvas p-3">
        <p className="text-xs font-medium text-ink-600">{t("templates.previewTitle")}</p>
        <p
          className="mt-1.5 font-mono text-xs leading-relaxed whitespace-pre-wrap"
          dir={dirOf(locale)}
        >
          {substitute(body, variables)}
        </p>
        <p className="mt-1.5 text-xs text-ink-600">{t("templates.previewHint")}</p>
      </div>
      {stray.length > 0 ? (
        <p className="rounded-xl bg-warn/12 p-3 text-xs text-warn-ink">
          {t("templates.undeclared", { names: listOf(stray, uiLocale) })}
        </p>
      ) : null}
    </div>
  );
}

function VariableList({ variables }: { variables: string[] }) {
  const t = useTranslations("admin.content");

  return (
    <aside className="space-y-2">
      <p className="text-xs font-medium text-ink-600">{t("templates.variablesTitle")}</p>
      {variables.length === 0 ? (
        <p className="text-xs text-ink-600">{t("templates.noVariables")}</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {variables.map((name) => (
            <li key={name}>
              <Badge variant="brand" className="font-mono" dir="ltr">
                {name}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

function Feedback({ error, note }: { error: string | null; note: string | null }) {
  if (error) {
    return (
      <p className="mt-3 flex items-start gap-1.5 text-sm text-down">
        <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        {error}
      </p>
    );
  }
  return note ? <p className="mt-3 text-sm text-up">{note}</p> : null;
}

function groupBy<T, K>(rows: readonly T[], key: (row: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>();
  for (const row of rows) {
    const bucket = out.get(key(row));
    if (bucket) bucket.push(row);
    else out.set(key(row), [row]);
  }
  return out;
}

function missingLocales(rows: readonly { locale: string }[]): Lang[] {
  return LOCALES.filter((lang) => !rows.some((row) => row.locale === lang));
}

function dirOf(locale: string): "rtl" | "ltr" {
  return locale === "fa" ? "rtl" : "ltr";
}

/**
 * A write the policy refuses is not always an error: PostgREST answers an
 * UPDATE that matched nothing with a green light and no rows, which reads
 * identically to a save that worked. Asking for the ids back is what tells the
 * two apart, so callers check the returned rows as well as the error.
 */
function writeFailure(message: string | undefined): "duplicate" | "forbidden" | "saveFailed" {
  if (message && /duplicate key|already exists/i.test(message)) return "duplicate";
  if (!message || /row-level security|permission denied|policy/i.test(message)) return "forbidden";
  return "saveFailed";
}

/** `variables` is a declared jsonb schema: a list of names, or a map of them. */
function declaredVariables(value: Json): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && !Array.isArray(item)) {
          const name = item.name;
          return typeof name === "string" ? name : null;
        }
        return null;
      })
      .filter((name): name is string => name !== null);
  }
  if (value && typeof value === "object") return Object.keys(value);
  return [];
}

/** Both brace styles appear in the seeded templates, so both are recognised. */
const PLACEHOLDER = /\{\{?\s*([A-Za-z0-9_.]+)\s*\}?\}/g;

function substitute(body: string, variables: readonly string[]): string {
  return body.replace(PLACEHOLDER, (whole, name: string) =>
    variables.includes(name) ? `{${name}}` : whole,
  );
}

function undeclaredIn(body: string, variables: readonly string[]): string[] {
  const found = [...body.matchAll(PLACEHOLDER)]
    .map((match) => match[1])
    .filter((name): name is string => name !== undefined);
  return [...new Set(found)].filter((name) => !variables.includes(name));
}

function listOf(names: readonly string[], locale: AppLocale): string {
  return new Intl.ListFormat(locale === "fa" ? "fa-IR" : "en-US", {
    style: "short",
    type: "unit",
  }).format(names);
}
