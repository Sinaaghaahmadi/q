"use client";

import { BadgeCheck, Clock3, Copy, Gift, LogOut, Smartphone } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { SecurityScene } from "@/components/brand/scenes";
import { TwoFactor } from "@/components/auth/two-factor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InfoHint } from "@/components/ui/info-hint";
import { Link, useRouter } from "@/i18n/navigation";
import { formatDate, type AppLocale } from "@/lib/money/format";
import { maskPhone } from "@/lib/sms/types";
import type { LoginEvent, Profile } from "@/lib/supabase/types";

const KYC_VARIANT = {
  approved: "up",
  pending: "warn",
  more_info_needed: "warn",
  rejected: "down",
  unverified: "neutral",
} as const;

export function ProfileView({
  profile,
  email,
  events,
  isStaff = false,
}: {
  profile: Profile | null;
  email: string | null;
  events: LoginEvent[];
  /** Staff accounts are told the second factor is required, not optional. */
  isStaff?: boolean;
}) {
  const t = useTranslations("profile");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const [copied, setCopied] = React.useState(false);

  const status = profile?.kyc_status ?? "unverified";

  async function signOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="mt-1 text-sm text-ink-600">{t("subtitle")}</p>
      </div>

      {/* Identity status */}
      <Card className="p-5">
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 dark:text-brand-600">
            <BadgeCheck className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold">
                {profile?.full_name_fa || profile?.full_name_latin || t("unnamed")}
              </p>
              <Badge variant={KYC_VARIANT[status]}>{t(`kyc.${status}`)}</Badge>
            </div>
            <p className="mt-1 text-xs text-ink-600" dir="ltr">
              {profile?.phone ? maskPhone(profile.phone) : (email ?? "—")}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ink-600">{t(`kycBody.${status}`)}</p>
            {status !== "approved" && status !== "pending" ? (
              <Button asChild size="sm" className="mt-3">
                <Link href="/verify">{t("startKyc")}</Link>
              </Button>
            ) : null}
          </div>
        </div>
      </Card>

      {/* Security */}
      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <SecurityScene size={96} label={t("security.title")} />
        <div className="flex-1">
          <h2 className="text-sm font-semibold">{t("security.title")}</h2>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm leading-relaxed text-ink-600">
            {t("security.body")}
            <InfoHint term="twoFactor" />
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant="up">
              <Smartphone className="size-3.5" />
              {t("security.otpOn")}
            </Badge>
          </div>
          <div className="mt-4 border-t border-ink-300/40 pt-4">
            <TwoFactor isStaff={isStaff} />
          </div>
        </div>
      </Card>

      {/* Referral */}
      {profile?.referral_code ? (
        <Card className="flex items-center gap-4 p-5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 dark:text-brand-600">
            <Gift className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{t("referral.title")}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-600">{t("referral.body")}</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              await navigator.clipboard.writeText(profile.referral_code ?? "");
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            }}
          >
            <Copy className="size-4" />
            <span className="num font-mono" dir="ltr">
              {copied ? t("referral.copied") : profile.referral_code}
            </span>
          </Button>
        </Card>
      ) : null}

      {/* Devices */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold">{t("devices.title")}</h2>
        <p className="mt-1 text-sm text-ink-600">{t("devices.body")}</p>
        <ul className="mt-3 divide-y divide-ink-300/40">
          {events.length === 0 ? (
            <li className="py-3 text-sm text-ink-600">{t("devices.none")}</li>
          ) : (
            events.slice(0, 6).map((event) => (
              <li key={event.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="inline-flex items-center gap-2 text-ink-600">
                  <Clock3 className="size-3.5" />
                  {t(`devices.kind.${event.kind}`)}
                </span>
                <span className="num text-xs text-ink-600">
                  {formatDate(event.created_at, locale, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              </li>
            ))
          )}
        </ul>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button asChild variant="secondary">
          <Link href="/accounts">{t("goAccounts")}</Link>
        </Button>
        <Button variant="ghost" onClick={signOut}>
          <LogOut className="size-4 rtl:-scale-x-100" />
          {t("signOut")}
        </Button>
      </div>
    </div>
  );
}
