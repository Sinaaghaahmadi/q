"use client";

import { CircleAlert, Lock, Save } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Link } from "@/i18n/navigation";
import {
  formatAmount,
  formatAmountInput,
  parseAmountInput,
  type AppLocale,
} from "@/lib/money/format";
import { fromMinor, toMinor } from "@/lib/money/minor";
import { createClient } from "@/lib/supabase/client";
import type { ExchangeOffice, Json } from "@/lib/supabase/types";

/** Saturday first: the office's week, not the browser's. */
const DAYS = ["sat", "sun", "mon", "tue", "wed", "thu", "fri"] as const;
type Day = (typeof DAYS)[number];

type Hours = { open: string; close: string; closed: boolean };

/**
 * `auto_accept_rules` is a real column on `exchange_offices` — 0003 declares it
 * and `admin_create_office` fills it from the platform template — but it is
 * absent from the checked-in row type, so the patch is described once here
 * rather than cast at each field.
 */
type SettingsPatch = Pick<ExchangeOffice, "working_hours" | "contact"> & {
  auto_accept_rules: Json;
};

/**
 * Working hours, auto-accept and where notices go (§4.2).
 *
 * These three columns live on `exchange_offices`, and `offices_admin_write` is
 * the only policy that grants a write there — a platform seat, not an office
 * one. So an owner reading this page can see every value and change none of
 * them, and the screen says exactly that instead of offering a Save button that
 * would silently do nothing. A refused UPDATE does not raise; it matches no row
 * and returns success, so the save asks for the row back and treats an empty
 * result as the refusal it is.
 */
export function OfficeSettingsForm({
  office,
  autoAcceptRules,
  canWrite,
}: {
  office: ExchangeOffice;
  autoAcceptRules: Json;
  canWrite: boolean;
}) {
  const t = useTranslations("officePanel.config");
  const locale = useLocale() as AppLocale;
  const router = useRouter();

  const hoursOnFile = readHours(office.working_hours);
  const autoOnFile = readAuto(autoAcceptRules);
  const contactOnFile = readContact(office.contact);

  const [week, setWeek] = React.useState<Record<Day, Hours>>(hoursOnFile.week);
  const [autoEnabled, setAutoEnabled] = React.useState(autoOnFile.enabled);
  const [autoMax, setAutoMax] = React.useState(
    autoOnFile.maxMinor === null ? "" : formatAmountInput(fromMinor(autoOnFile.maxMinor, "IRT")),
  );
  const [contact, setContact] = React.useState(contactOnFile);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<string | null>(null);

  async function save() {
    for (const day of DAYS) {
      const row = week[day];
      if (row.closed) continue;
      if (!row.open || !row.close) {
        setError(t("settings.errors.timeMissing"));
        return;
      }
      if (row.close <= row.open) {
        setError(t("settings.errors.timeOrder"));
        return;
      }
    }

    let maxMinor: number | null = null;
    if (autoMax.trim() !== "") {
      const value = parseAmountInput(autoMax);
      if (value === null || value < 0) {
        setError(t("settings.errors.amountInvalid"));
        return;
      }
      try {
        maxMinor = toMinor(value, "IRT");
      } catch {
        setError(t("settings.errors.amountInvalid"));
        return;
      }
    }

    const patch: SettingsPatch = {
      working_hours: {
        ...(hoursOnFile.tz ? { tz: hoursOnFile.tz } : {}),
        week: Object.fromEntries(
          DAYS.map((day) => [
            day,
            week[day].closed ? null : `${week[day].open}-${week[day].close}`,
          ]),
        ),
      },
      auto_accept_rules: { enabled: autoEnabled, max_amount_minor: maxMinor },
      contact: {
        phone: contact.phone.trim(),
        email: contact.email.trim(),
        notify: { sms: contact.sms, email: contact.email_notice },
      },
    };

    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data, error: dbError } = await supabase
      .from("exchange_offices")
      // `auto_accept_rules` is not in the checked-in row type, and the client
      // rejects any key it cannot see; the column is real, so widen once here.
      .update(patch as Partial<ExchangeOffice>)
      .eq("id", office.id)
      .select("id");
    setBusy(false);

    if (dbError) {
      setError(t("settings.errors.saveFailed"));
      return;
    }
    if ((data ?? []).length === 0) {
      setError(t("settings.errors.forbidden"));
      return;
    }
    setNote(t("settings.saved"));
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {!canWrite ? (
        <div className="flex items-start gap-2.5 rounded-xl bg-info/12 p-4 text-sm text-info-ink">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            <span className="block font-semibold">{t("settings.lockedTitle")}</span>
            <span className="mt-1 block leading-relaxed">{t("settings.lockedBody")}</span>
            <Link
              href="/support"
              className="mt-2 inline-block font-medium underline underline-offset-4"
            >
              {t("settings.supportCta")}
            </Link>
          </span>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.hours.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-ink-600">
            {hoursOnFile.tz
              ? t("settings.hours.body", { tz: hoursOnFile.tz })
              : t("settings.hours.bodyUnknown")}
          </p>
          {DAYS.map((day) => (
            <div key={day} className="flex flex-wrap items-end gap-3">
              <span className="w-24 pb-3 text-sm font-medium">
                {t(`settings.hours.day.${day}`)}
              </span>
              <label className="text-sm">
                <span className="block text-xs text-ink-600">{t("settings.hours.open")}</span>
                <Input
                  dir="ltr"
                  className="mt-1 w-32 text-start"
                  type="time"
                  value={week[day].open}
                  disabled={!canWrite || week[day].closed}
                  onChange={(e) =>
                    setWeek((w) => ({ ...w, [day]: { ...w[day], open: e.target.value } }))
                  }
                />
              </label>
              <label className="text-sm">
                <span className="block text-xs text-ink-600">{t("settings.hours.close")}</span>
                <Input
                  dir="ltr"
                  className="mt-1 w-32 text-start"
                  type="time"
                  value={week[day].close}
                  disabled={!canWrite || week[day].closed}
                  onChange={(e) =>
                    setWeek((w) => ({ ...w, [day]: { ...w[day], close: e.target.value } }))
                  }
                />
              </label>
              <span className="flex items-center gap-2 pb-3">
                <Switch
                  checked={week[day].closed}
                  disabled={!canWrite}
                  aria-label={`${t(`settings.hours.day.${day}`)} — ${t("settings.hours.closedLabel")}`}
                  onCheckedChange={(v) =>
                    setWeek((w) => ({ ...w, [day]: { ...w[day], closed: v } }))
                  }
                />
                <span className="text-sm text-ink-600">{t("settings.hours.closedLabel")}</span>
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.auto.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-ink-600">{t("settings.auto.body")}</p>
          <ToggleField
            label={t("settings.auto.enabledLabel")}
            checked={autoEnabled}
            disabled={!canWrite}
            onChange={setAutoEnabled}
          />
          <label className="block max-w-xs text-sm font-medium">
            {t("settings.auto.maxLabel")}
            <Input
              dir="ltr"
              className="mt-1.5 text-start tabular-nums"
              inputMode="decimal"
              value={autoMax}
              disabled={!canWrite}
              onChange={(e) => setAutoMax(e.target.value)}
            />
            <span className="mt-1 block text-xs font-normal text-ink-600">
              {t("settings.auto.maxHint")}
            </span>
            <span className="mt-0.5 block text-xs font-normal text-ink-600">
              {autoOnFile.maxMinor === null
                ? t("settings.auto.noLimit")
                : t("settings.auto.onFile", {
                    amount: formatAmount(fromMinor(autoOnFile.maxMinor, "IRT"), "IRT", locale),
                  })}
            </span>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.notify.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-ink-600">{t("settings.notify.body")}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              {t("settings.notify.phone")}
              <Input
                dir="ltr"
                className="mt-1.5 text-start font-mono text-xs"
                type="tel"
                value={contact.phone}
                disabled={!canWrite}
                placeholder={t("settings.notify.phonePlaceholder")}
                onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))}
              />
            </label>
            <label className="block text-sm font-medium">
              {t("settings.notify.email")}
              <Input
                dir="ltr"
                className="mt-1.5 text-start"
                type="email"
                value={contact.email}
                disabled={!canWrite}
                placeholder={t("settings.notify.emailPlaceholder")}
                onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <ToggleField
              label={t("settings.notify.smsLabel")}
              hint={t("settings.notify.smsHint")}
              checked={contact.sms}
              disabled={!canWrite}
              onChange={(v) => setContact((c) => ({ ...c, sms: v }))}
            />
            <ToggleField
              label={t("settings.notify.emailLabel")}
              hint={t("settings.notify.emailHint")}
              checked={contact.email_notice}
              disabled={!canWrite}
              onChange={(v) => setContact((c) => ({ ...c, email_notice: v }))}
            />
          </div>
        </CardContent>
      </Card>

      {canWrite ? (
        <Button disabled={busy} onClick={save}>
          <Save className="size-4" aria-hidden />
          {busy ? t("settings.working") : t("settings.save")}
        </Button>
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

function ToggleField({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
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
        aria-describedby={hint ? hintId : undefined}
        onCheckedChange={onChange}
      />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint ? (
          <span id={hintId} className="block text-xs text-ink-600">
            {hint}
          </span>
        ) : null}
      </span>
    </span>
  );
}

function object(value: Json | undefined): Record<string, Json> {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

/** `{ tz, week: { sat: "09:00-17:00", fri: null } }` — the shape the template writes. */
function readHours(value: Json): { tz: string | null; week: Record<Day, Hours> } {
  const root = object(value);
  const raw = object(root.week);
  const week = Object.fromEntries(
    DAYS.map((day) => {
      const span = raw[day];
      if (typeof span !== "string") return [day, { open: "", close: "", closed: true }];
      const [open = "", close = ""] = span.split("-");
      return [day, { open: open.slice(0, 5), close: close.slice(0, 5), closed: false }];
    }),
  ) as Record<Day, Hours>;
  return { tz: typeof root.tz === "string" ? root.tz : null, week };
}

function readAuto(value: Json): { enabled: boolean; maxMinor: number | null } {
  const root = object(value);
  const max = root.max_amount_minor;
  return {
    enabled: root.enabled === true,
    maxMinor: typeof max === "number" && Number.isFinite(max) ? max : null,
  };
}

function readContact(value: Json): {
  phone: string;
  email: string;
  sms: boolean;
  email_notice: boolean;
} {
  const root = object(value);
  const notify = object(root.notify);
  return {
    phone: typeof root.phone === "string" ? root.phone : "",
    email: typeof root.email === "string" ? root.email : "",
    // Only a recorded `true` reads as on. `contact` is `{}` on every office the
    // platform provisions, and the switch is disabled for anyone who can open
    // this page, so treating absent as on would show every office a preference
    // nobody set and nobody here can clear.
    sms: notify.sms === true,
    email_notice: notify.email === true,
  };
}
