"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatAmount, formatDate, formatNumber, type AppLocale } from "@/lib/money/format";
import { fromMinor } from "@/lib/money/minor";
import type { KycStatus } from "@/lib/supabase/types";

export type CustomerRow = {
  id: string;
  name: string | null;
  orders: number;
  /** Toman leg of the completed orders only, in minor units. */
  volumeMinor: number;
  lastOrderAt: string;
  /** null when the profile is not readable — not the same as "unverified". */
  kyc: KycStatus | null;
};

const KYC_TONE = {
  unverified: "neutral",
  pending: "info",
  approved: "up",
  rejected: "down",
  more_info_needed: "warn",
} as const;

/**
 * Who this office has served, and nothing more.
 *
 * An office needs to recognise a returning customer and know whether the
 * platform has verified them; it has no business with national codes, dates of
 * birth or documents, so none of that is fetched — the profile policy would
 * refuse most of it anyway, and a column that is empty for policy reasons reads
 * like a bug. The search box exists because this list only grows.
 */
export function CustomerList({ customers }: { customers: CustomerRow[] }) {
  const t = useTranslations("officePanel.customers");
  const locale = useLocale() as AppLocale;
  const [query, setQuery] = React.useState("");

  const q = query.trim().toLowerCase();
  const shown = q ? customers.filter((c) => (c.name ?? "").toLowerCase().includes(q)) : customers;

  return (
    <div className="space-y-4">
      <Input
        type="search"
        aria-label={t("searchLabel")}
        placeholder={t("searchPlaceholder")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="max-w-sm"
      />

      {shown.length === 0 ? (
        <Card className="p-10 text-center text-sm text-ink-600">
          {customers.length === 0 ? t("empty") : t("emptyFiltered")}
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="border-b border-ink-300/40 text-xs text-ink-600">
              <tr>
                <th className="px-4 py-3 text-start font-medium">{t("col.name")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("col.orders")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("col.volume")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("col.last")}</th>
                <th className="px-4 py-3 text-end font-medium">{t("col.kyc")}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((customer) => (
                <tr key={customer.id} className="border-b border-ink-300/25 last:border-0">
                  <td className="px-4 py-3 font-medium">{customer.name ?? t("unnamed")}</td>
                  <td className="num px-4 py-3">{formatNumber(customer.orders, locale)}</td>
                  <td className="num px-4 py-3">
                    {formatAmount(fromMinor(customer.volumeMinor, "IRT"), "IRT", locale)}{" "}
                    <span className="text-xs font-normal text-ink-600">{t("toman")}</span>
                  </td>
                  <td className="num px-4 py-3 text-ink-600">
                    {formatDate(customer.lastOrderAt, locale)}
                  </td>
                  <td className="px-4 py-3 text-end">
                    {customer.kyc ? (
                      <Badge variant={KYC_TONE[customer.kyc]}>{t(`kyc.${customer.kyc}`)}</Badge>
                    ) : (
                      <Badge variant="neutral">{t("kyc.unknown")}</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <p className="text-xs text-ink-600">
        {t("volumeHint")} {t("privacy")}
      </p>
    </div>
  );
}
