"use client";

import { Info, Snowflake } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import * as React from "react";
import { PanelSection } from "@/components/layout/panel-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { formatAmount, formatDate, formatNumber, type AppLocale } from "@/lib/money/format";
import { fromMinor } from "@/lib/money/minor";
import { createClient } from "@/lib/supabase/client";
import { LOGINS_SHOWN, ORDERS_SHOWN } from "@/lib/admin/filters";
import { stateTone } from "@/lib/orders/flow";
import type { CurrencyCode } from "@/lib/rates/catalog";
import type { BeneficiaryAccount, Json, LoginEvent, Order, Profile } from "@/lib/supabase/types";

/** One row of `public.referrals`, with the other party's name already resolved. */
export type ReferralRow = {
  id: string;
  userId: string;
  name: string | null;
  code: string;
  rewardedAt: string | null;
  createdAt: string;
};

/** The shape `customer_tier` returns; every field is optional because it is jsonb. */
type Tier = {
  tier?: string;
  commission_discount_pct?: number;
  volume_irt?: number;
  next?: { key?: string; from_irt?: number } | null;
  to_next_irt?: number | null;
};

/**
 * How far back the detail page reads. Exported because the page issues the
 * queries and the cards own the note that admits to the cap; one number keeps
 * the two from drifting into a list that is short without saying why.
 */

const KYC_TONE = {
  unverified: "neutral",
  pending: "info",
  approved: "up",
  rejected: "down",
  more_info_needed: "warn",
} as const;

const VERIFICATION_TONE = {
  unverified: "neutral",
  pending: "info",
  verified: "up",
  rejected: "down",
} as const;

const TIER_KEYS = ["standard", "silver", "gold", "platinum"] as const;

/** `customer_tier` reads its keys from a settings row, so an unknown one is possible. */
function tierKey(value: string | undefined): (typeof TIER_KEYS)[number] {
  return TIER_KEYS.find((key) => key === value) ?? "standard";
}

/**
 * Everything the platform holds about one customer, on one page (§4.3).
 *
 * The sections are ordered the way a support call goes: who is this, what are
 * they worth to us, what have they ordered, where does their money go, when
 * were they last here, who brought them. Nothing is behind a tab, because the
 * question that brought an agent here is rarely the one a tab is labelled with.
 */
export function UserDetail({
  profile,
  tier,
  orders,
  destinations,
  logins,
  invited,
  invitedBy,
  canFreeze,
}: {
  profile: Profile;
  tier: Json | null;
  orders: Order[];
  destinations: BeneficiaryAccount[];
  logins: LoginEvent[];
  invited: ReferralRow[];
  invitedBy: ReferralRow | null;
  /** Mirrors `profile_set_frozen`; the function is what actually refuses. */
  canFreeze: boolean;
}) {
  const t = useTranslations("admin.users");
  const states = useTranslations("orders.state");
  const locale = useLocale() as AppLocale;
  const router = useRouter();

  const frozen = profile.frozen_at !== null;
  const [reason, setReason] = React.useState("");
  const [freezing, setFreezing] = React.useState(false);
  const [freezeError, setFreezeError] = React.useState<string | null>(null);

  /**
   * Freeze the account, or open it again.
   *
   * The reason travels with the call rather than being written separately: the
   * function refuses without one and records it in the audit log, so "why is
   * this account closed" survives the person who closed it. Both directions
   * need one — reopening an account is the decision somebody will want
   * explained later, and it is the one nobody thinks to write down.
   */
  async function setFrozen(next: boolean) {
    if (reason.trim().length < 8) {
      setFreezeError(t("freezeReasonTooShort"));
      return;
    }
    setFreezing(true);
    setFreezeError(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("profile_set_frozen", {
      p_user: profile.id,
      p_frozen: next,
      p_reason: reason.trim(),
    });
    setFreezing(false);
    if (error) {
      setFreezeError(
        /written reason/i.test(error.message)
          ? t("freezeReasonTooShort")
          : /administrator or compliance/i.test(error.message)
            ? t("freezeForbidden")
            : /staff accounts/i.test(error.message)
              ? t("freezeStaff")
              : /already frozen|not frozen/i.test(error.message)
                ? t("freezeStale")
                : t("freezeFailed"),
      );
      return;
    }
    setReason("");
    router.refresh();
  }

  // An empty answer from `customer_tier` is not a customer with no history: read
  // as an object it would claim Standard, zero volume and top tier at once. So
  // the card says the figure is missing rather than assembling one out of
  // fallbacks.
  const current = tier ? (tier as Tier) : null;
  const volume = current?.volume_irt ?? 0;
  const toNext = current?.to_next_irt ?? null;

  return (
    <div className="space-y-4">
      {profile.frozen_at ? (
        <Card className="flex flex-wrap items-center gap-3 bg-down/12 p-4 text-sm text-down-ink">
          <Snowflake className="size-4 shrink-0" aria-hidden />
          <span className="font-medium">
            {t("frozenSince", { date: formatDate(profile.frozen_at, locale) })}
          </span>
          {profile.frozen_reason ? (
            <span>
              · {t("frozenReasonLabel")}: {profile.frozen_reason}
            </span>
          ) : null}
        </Card>
      ) : null}

      <PanelSection
        title={t("identityTitle")}
        hint={t("identityHint")}
        bodyClassName="grid gap-x-6 gap-y-3 sm:grid-cols-2"
      >
        <Field label={t("identity.nameFa")} value={profile.full_name_fa ?? t("notSet")} />
        <Field label={t("identity.nameLatin")} value={profile.full_name_latin ?? t("notSet")} ltr />
        <Field label={t("identity.phone")} value={profile.phone ?? t("notSet")} ltr>
          <Badge variant={profile.phone_verified_at ? "up" : "neutral"}>
            {profile.phone_verified_at ? t("phoneVerified") : t("phoneUnverified")}
          </Badge>
        </Field>
        <Field label={t("identity.email")} value={profile.email ?? t("notSet")} ltr />
        <Field
          label={t("identity.nationalCode")}
          value={profile.national_code ?? t("notSet")}
          ltr
        />
        <Field
          label={t("identity.dob")}
          value={profile.dob ? formatDate(profile.dob, locale) : t("notSet")}
        />
        <Field label={t("identity.nationality")} value={profile.nationality ?? t("notSet")} ltr />
        <Field
          label={t("identity.kyc")}
          value={
            <Badge variant={KYC_TONE[profile.kyc_status]}>{t(`kyc.${profile.kyc_status}`)}</Badge>
          }
        />
        <Field
          label={t("identity.risk")}
          value={t("risk", { tier: formatNumber(profile.risk_tier, locale) })}
        />
        <Field
          label={t("identity.referralCode")}
          value={profile.referral_code ?? t("notSet")}
          ltr
        />
        <Field
          label={t("identity.joined")}
          value={formatDate(profile.created_at, locale, { dateStyle: "long" })}
        />
      </PanelSection>

      <PanelSection title={t("tierTitle")} hint={t("tierHint")} bodyClassName="space-y-2">
        {current === null ? (
          <p className="text-sm text-ink-600">{t("tierUnavailable")}</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="brand">{t(`tier.${tierKey(current.tier)}`)}</Badge>
              <span className="text-sm text-ink-600">
                {t("tierFee", {
                  pct: formatNumber(Number(current.commission_discount_pct ?? 0), locale, {
                    maximumFractionDigits: 2,
                  }),
                })}
              </span>
            </div>
            <p className="num text-sm">
              <span className="text-ink-600">{t("tierVolume")}: </span>
              {formatAmount(fromMinor(volume, "IRT"), "IRT", locale)} {t("toman")}
            </p>
            <p className="num text-sm text-ink-600">
              {toNext !== null && current.next
                ? t("tierToNext", {
                    amount: formatAmount(fromMinor(toNext, "IRT"), "IRT", locale),
                    tier: t(`tier.${tierKey(current.next.key)}`),
                  })
                : t("tierTop")}
            </p>
          </>
        )}
      </PanelSection>

      <PanelSection title={t("ordersTitle")} hint={t("ordersHint")} bodyClassName="p-0">
        {orders.length === 0 ? (
          <p className="p-6 text-sm text-ink-600">{t("noOrders")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="border-b border-ink-300/40 text-xs text-ink-600">
                <tr>
                  <th className="px-4 py-3 text-start font-medium">{t("orderCol.ref")}</th>
                  <th className="px-4 py-3 text-start font-medium">{t("orderCol.corridor")}</th>
                  <th className="px-4 py-3 text-start font-medium">{t("orderCol.amount")}</th>
                  <th className="px-4 py-3 text-start font-medium">{t("orderCol.state")}</th>
                  <th className="px-4 py-3 text-end font-medium">{t("orderCol.created")}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-ink-300/25 last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        href={`/orders/${order.id}`}
                        className="num font-mono text-xs hover:text-brand-700"
                        dir="ltr"
                      >
                        {order.public_ref}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      <span dir="ltr">{order.corridor}</span>
                    </td>
                    <td className="num px-4 py-3">
                      {formatAmount(
                        fromMinor(order.send_amount_minor, order.send_currency as CurrencyCode),
                        order.send_currency as CurrencyCode,
                        locale,
                      )}{" "}
                      <span className="text-xs text-ink-600">{order.send_currency}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={stateTone(order.state)}>{states(order.state)}</Badge>
                    </td>
                    <td className="num px-4 py-3 text-end text-ink-600">
                      {formatDate(order.created_at, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {orders.length >= ORDERS_SHOWN ? (
          <p className="border-t border-ink-300/25 px-4 py-3 text-xs text-ink-600">
            {t("ordersCapped", { count: formatNumber(ORDERS_SHOWN, locale) })}
          </p>
        ) : null}
      </PanelSection>

      <div className="grid gap-4 lg:grid-cols-2">
        <PanelSection title={t("destinationsTitle")} hint={t("destinationsHint")}>
          {destinations.length === 0 ? (
            <p className="text-sm text-ink-600">{t("noDestinations")}</p>
          ) : (
            <ul className="space-y-3">
              {destinations.map((account) => (
                <li key={account.id} className="border-b border-ink-300/25 pb-3 last:border-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{account.nickname}</span>
                    <Badge variant={VERIFICATION_TONE[account.verification_state]}>
                      {t(`verification.${account.verification_state}`)}
                    </Badge>
                    {account.is_third_party ? (
                      <Badge variant="warn">{t("thirdParty")}</Badge>
                    ) : null}
                    {account.archived_at ? <Badge variant="outline">{t("archived")}</Badge> : null}
                  </div>
                  <p className="mt-1 text-sm text-ink-600">
                    {account.holder_name} · {t(`kind.${account.kind}`)} · {account.currency}{" "}
                    {account.country}
                  </p>
                  <p className="num mt-0.5 font-mono text-xs break-all text-ink-600" dir="ltr">
                    {identifierOf(account)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </PanelSection>

        <PanelSection title={t("loginsTitle")} hint={t("loginsHint")}>
          {logins.length === 0 ? (
            <p className="text-sm text-ink-600">{t("noLogins")}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {logins.map((event) => (
                <li key={event.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <Badge variant="neutral">{t(`loginKind.${event.kind}`)}</Badge>
                  <span className="min-w-0 flex-1 truncate text-ink-600">
                    {event.device_label ?? event.user_agent ?? t("unknownDevice")}
                  </span>
                  {event.ip ? (
                    <span className="num font-mono text-xs text-ink-600" dir="ltr">
                      {event.ip}
                    </span>
                  ) : null}
                  <time dateTime={event.created_at} className="num text-xs text-ink-600">
                    {formatDate(event.created_at, locale)}
                  </time>
                </li>
              ))}
            </ul>
          )}
          {logins.length >= LOGINS_SHOWN ? (
            <p className="mt-3 text-xs text-ink-600">
              {t("loginsCapped", { count: formatNumber(LOGINS_SHOWN, locale) })}
            </p>
          ) : null}
        </PanelSection>
      </div>

      <PanelSection title={t("referralsTitle")} hint={t("referralsHint")} bodyClassName="space-y-3">
        <p className="text-sm text-ink-600">
          {invitedBy
            ? t("invitedBy", {
                name: invitedBy.name ?? t("unnamed"),
                code: invitedBy.code,
              })
            : t("invitedByNobody")}
        </p>

        {invited.length === 0 ? (
          <p className="text-sm text-ink-600">{t("noReferrals")}</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {invited.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Link
                  href={`/admin/users/${row.userId}`}
                  className="font-medium hover:text-brand-700"
                >
                  {row.name ?? t("unnamed")}
                </Link>
                <span className="num font-mono text-xs text-ink-600" dir="ltr">
                  {row.code}
                </span>
                <span className="num text-xs text-ink-600">
                  {formatDate(row.createdAt, locale)}
                </span>
                {row.rewardedAt ? (
                  <Badge variant="up">{t("rewarded")}</Badge>
                ) : (
                  <Badge variant="neutral">{t("rewardPending")}</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </PanelSection>

      <PanelSection
        title={t("freezeTitle")}
        hint={t("freezeHint")}
        bodyClassName="space-y-3"
        className={frozen ? "[--glass-tint:var(--down)]" : undefined}
      >
        <p className="text-sm text-ink-600">{t("freezeBody")}</p>

        {frozen ? (
          <p className="flex items-start gap-1.5 rounded-xl bg-down/12 p-3 text-sm text-down-ink">
            <Snowflake className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              {t("frozenSince", { date: formatDate(profile.frozen_at as string, locale) })}
              {profile.frozen_reason ? ` — ${profile.frozen_reason}` : ""}
            </span>
          </p>
        ) : null}

        {canFreeze ? (
          <>
            <label className="block text-sm font-medium">
              {t("freezeReason")}
              <Input
                className="mt-1.5"
                placeholder={frozen ? t("unfreezeReasonPlaceholder") : t("freezeReasonPlaceholder")}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
              {/* Stated before the press, not after the refusal: the function
                  requires eight characters and there is no reason to let
                  somebody find that out by being turned down. */}
              <span className="mt-1 block text-xs font-normal text-ink-600">
                {t("freezeReasonRule")}
              </span>
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant={frozen ? "secondary" : "destructive"}
                disabled={freezing || reason.trim().length < 8}
                onClick={() => setFrozen(!frozen)}
              >
                <Snowflake className="size-4" aria-hidden />
                {freezing ? t("freezeWorking") : frozen ? t("unfreeze") : t("freeze")}
              </Button>
              {frozen ? null : (
                <span className="self-center text-sm text-ink-600">{t("notFrozen")}</span>
              )}
            </div>

            {freezeError ? (
              <p className="text-sm leading-relaxed text-down">{freezeError}</p>
            ) : null}
          </>
        ) : (
          <p className="flex items-start gap-1.5 rounded-xl bg-info/12 p-3 text-sm text-info-ink">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t("freezeForbidden")}
          </p>
        )}
      </PanelSection>
    </div>
  );
}

function Field({
  label,
  value,
  ltr,
  children,
}: {
  label: string;
  value: React.ReactNode;
  ltr?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-ink-600">{label}</p>
      <div className="mt-0.5 flex flex-wrap items-center gap-2">
        <span className="num text-sm break-all" dir={ltr ? "ltr" : undefined}>
          {value}
        </span>
        {children}
      </div>
    </div>
  );
}

/** Beneficiary details are a free-form map; these are the keys the account form writes. */
function identifierOf(account: BeneficiaryAccount): string {
  return (
    account.details.sheba ??
    account.details.card ??
    account.details.iban ??
    account.details.swift ??
    "—"
  );
}
