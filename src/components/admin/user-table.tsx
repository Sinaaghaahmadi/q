"use client";

import { Info, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Link, useRouter } from "@/i18n/navigation";
import { KYC_STATUSES } from "@/lib/admin/filters";
import { formatAmount, formatDate, formatNumber, type AppLocale } from "@/lib/money/format";
import { fromMinor } from "@/lib/money/minor";
import type { Profile } from "@/lib/supabase/types";

export type UserRow = Pick<
  Profile,
  | "id"
  | "full_name_fa"
  | "full_name_latin"
  | "phone"
  | "kyc_status"
  | "risk_tier"
  | "frozen_at"
  | "created_at"
> & {
  orders: number;
  /** Toman leg of the completed orders only, in minor units. */
  volumeMinor: number;
};

export type AccessFilter = "" | "yes" | "no";

const KYC_TONE = {
  unverified: "neutral",
  pending: "info",
  approved: "up",
  rejected: "down",
  more_info_needed: "warn",
} as const;

/** Risk is a smallint with no ceiling, so anything above the known band reads as the worst one. */
function riskTone(tier: number): "neutral" | "info" | "warn" | "down" {
  if (tier >= 3) return "down";
  if (tier === 2) return "warn";
  if (tier === 1) return "info";
  return "neutral";
}

/**
 * Every customer (§4.3), and the one row an operator is looking for.
 *
 * Search and both filters live in the URL rather than in component state: the
 * matching happens in Postgres over the whole table, not over the 200 rows that
 * happened to be fetched, and a support agent can paste the resulting link into
 * a ticket and land on the same list.
 */
export function AdminUserTable({
  users,
  query,
  kyc,
  access,
  totalsTruncated,
}: {
  users: UserRow[];
  query: string;
  kyc: string;
  access: AccessFilter;
  /** Set when the orders behind the last two columns were read only in part. */
  totalsTruncated: boolean;
}) {
  const t = useTranslations("admin.users");
  const locale = useLocale() as AppLocale;
  const router = useRouter();

  const [q, setQ] = React.useState(query);

  function search(next: { kyc?: string; access?: AccessFilter } = {}) {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    const nextKyc = next.kyc ?? kyc;
    const nextAccess = next.access ?? access;
    if (nextKyc) params.set("kyc", nextKyc);
    if (nextAccess) params.set("frozen", nextAccess);
    router.push(`/admin/users${params.size > 0 ? `?${params}` : ""}`);
  }

  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
      >
        <Input
          type="search"
          className="max-w-xs"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchLabel")}
        />
        <Button type="submit" variant="secondary">
          <Search className="size-4" aria-hidden />
          {t("search")}
        </Button>
        <select
          value={kyc}
          onChange={(e) => search({ kyc: e.target.value })}
          aria-label={t("kycFilter")}
          className="h-11 rounded-xl border border-ink-300 bg-surface px-3 text-sm focus:border-brand-600 focus:ring-2 focus:ring-brand-600/25 focus:outline-none"
        >
          <option value="">{t("kycAll")}</option>
          {KYC_STATUSES.map((status) => (
            <option key={status} value={status}>
              {t(`kyc.${status}`)}
            </option>
          ))}
        </select>
        <Segmented<AccessFilter>
          label={t("accessFilter")}
          value={access}
          onChange={(value) => search({ access: value })}
          options={[
            { value: "", label: t("accessAll") },
            { value: "no", label: t("accessOpen") },
            { value: "yes", label: t("accessFrozen") },
          ]}
        />
      </form>

      {users.length === 0 ? (
        <Card className="p-10 text-center text-sm text-ink-600">
          {query || kyc || access ? t("emptyFiltered") : t("empty")}
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="border-b border-ink-300/40 text-xs text-ink-600">
              <tr>
                <th className="px-4 py-3 text-start font-medium">{t("col.name")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("col.phone")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("col.kyc")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("col.risk")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("col.access")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("col.orders")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("col.volume")}</th>
                <th className="px-4 py-3 text-end font-medium">{t("col.joined")}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const name =
                  (locale === "fa"
                    ? (user.full_name_fa ?? user.full_name_latin)
                    : (user.full_name_latin ?? user.full_name_fa)) ?? null;
                return (
                  <tr key={user.id} className="border-b border-ink-300/25 last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/users/${user.id}`}
                        className="font-medium hover:text-brand-700"
                      >
                        {name ?? t("unnamed")}
                      </Link>
                    </td>
                    <td className="num px-4 py-3 font-mono text-xs" dir="ltr">
                      {user.phone ?? t("notSet")}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={KYC_TONE[user.kyc_status]}>
                        {t(`kyc.${user.kyc_status}`)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={riskTone(user.risk_tier)}>
                        {t("risk", { tier: formatNumber(user.risk_tier, locale) })}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {user.frozen_at ? (
                        <Badge variant="down">{t("frozenBadge")}</Badge>
                      ) : (
                        <Badge variant="neutral">{t("openBadge")}</Badge>
                      )}
                    </td>
                    <td className="num px-4 py-3">{formatNumber(user.orders, locale)}</td>
                    <td className="num px-4 py-3">
                      {formatAmount(fromMinor(user.volumeMinor, "IRT"), "IRT", locale)}{" "}
                      <span className="text-xs text-ink-600">{t("toman")}</span>
                    </td>
                    <td className="num px-4 py-3 text-end text-ink-600">
                      {formatDate(user.created_at, locale)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {totalsTruncated ? (
        <p className="flex items-start gap-1.5 rounded-xl bg-warn/12 p-3 text-sm text-warn-ink">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t("totalsTruncated")}
        </p>
      ) : null}

      <p className="text-xs text-ink-600">
        {t("shown", { count: formatNumber(users.length, locale) })} {t("volumeHint")}
      </p>
    </div>
  );
}
