"use client";

import { BadgeCheck, Bell, Clock3, LogOut, Smartphone, Wallet } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { SecurityScene } from "@/components/brand/scenes";
import { NavGroup, NavRow } from "@/components/layout/nav-list";
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
  const tNav = useTranslations("nav");
  const tMenu = useTranslations("menu");
  const locale = useLocale() as AppLocale;
  const router = useRouter();

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

      {/*
        The account's own destinations, as the grouped list a phone uses.
        These three used to sit in the navigation sheet, which put "my saved
        bank accounts" beside "about us" and "terms of service". They belong to
        the person, so they live on the person's page — and the sheet is
        shorter for it.
      */}
      <NavGroup title={tMenu("group.account")}>
        <NavRow
          href="/accounts"
          label={tNav("accounts")}
          hint={tMenu("hint.accounts")}
          icon={<Wallet className="size-4.5" />}
          hue="brand"
        />
        <NavRow
          href="/verify"
          label={tNav("verify")}
          hint={tMenu("hint.verify")}
          icon={<BadgeCheck className="size-4.5" />}
          hue="indigo"
        />
        <NavRow
          href="/rates?alerts=1"
          label={tMenu("alerts")}
          hint={tMenu("hint.alerts")}
          icon={<Bell className="size-4.5" />}
          hue="amber"
        />
      </NavGroup>

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

      {/*
        The referral card used to live here as well, printing the same code
        with the same copy button that `TierAndReferral` prints further down.
        One code, one place: the section that can also show how many invitations
        have paid out kept it.
      */}
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

      {/* Only the way out. "Manage accounts" was a second door to the row at
          the top of this page. */}
      <Button variant="ghost" className="w-full sm:w-auto" onClick={signOut}>
        <LogOut className="size-4 rtl:-scale-x-100" />
        {t("signOut")}
      </Button>
    </div>
  );
}
