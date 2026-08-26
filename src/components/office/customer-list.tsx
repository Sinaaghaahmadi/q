"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { formatAmount, formatDate, formatNumber, type AppLocale } from "@/lib/money/format";
import { fromMinor } from "@/lib/money/minor";

export type CustomerRow = {
  id: string;
  orders: number;
  /** Toman leg of the completed orders only, in minor units. */
  volumeMinor: number;
  lastOrderAt: string;
};

/**
 * Who this office has served, and nothing more.
 *
 * There is deliberately no name and no verification column. `profiles_self_read`
 * is the only read policy on profiles — your own row, or platform staff — so an
 * office cannot reach a customer's name, and a column that is blank for policy
 * reasons reads like a bug rather than like a boundary. What the office can
 * honestly show is the reference it already sees on the requests queue, so that
 * is what identifies a row here and what the search box matches, on the short
 * form or the whole id.
 */
export function CustomerList({
  customers,
  truncatedAfter,
}: {
  customers: CustomerRow[];
  /** How many orders were folded, when the ceiling stopped the count short. */
  truncatedAfter: number | null;
}) {
  const t = useTranslations("officePanel.customers");
  const locale = useLocale() as AppLocale;
  const [query, setQuery] = React.useState("");

  const q = query.trim().toLowerCase();
  const shown = q ? customers.filter((c) => c.id.toLowerCase().includes(q)) : customers;

  return (
    <div className="space-y-4">
      <Input
        type="search"
        aria-label={t("search.label")}
        placeholder={t("search.placeholder")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="max-w-sm"
      />

      {shown.length === 0 ? (
        <Card className="p-10 text-center text-sm text-ink-600">
          {customers.length === 0 ? t("empty") : t("noMatch")}
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="border-b border-ink-300/40 text-xs text-ink-600">
              <tr>
                <th className="px-4 py-3 text-start font-medium">{t("col.ref")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("col.orders")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("col.volume")}</th>
                <th className="px-4 py-3 text-end font-medium">{t("col.last")}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((customer) => (
                <tr
                  key={customer.id}
                  className="border-b border-ink-300/25 transition-colors last:border-0 hover:bg-ink-300/10"
                >
                  <td className="px-4 py-3">
                    {/* The reference opens this customer's whole history at
                        this office. It is the only handle an office has on a
                        person — RLS keeps the name away from them — so it had
                        better lead somewhere. */}
                    <Link
                      href={`/office/requests?customer=${customer.id}`}
                      className="num font-mono text-xs font-medium hover:text-brand-700 dark:hover:text-brand-600"
                      dir="ltr"
                    >
                      {customer.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="num px-4 py-3">{formatNumber(customer.orders, locale)}</td>
                  <td className="num px-4 py-3">
                    {formatAmount(fromMinor(customer.volumeMinor, "IRT"), "IRT", locale)}{" "}
                    <span className="text-xs font-normal text-ink-600">{t("toman")}</span>
                  </td>
                  <td className="num px-4 py-3 text-end text-ink-600">
                    {formatDate(customer.lastOrderAt, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <p className="text-xs text-ink-600">
        {t("volumeHint")} {t("identityNote")}
        {truncatedAfter !== null
          ? ` ${t("truncated", { count: formatNumber(truncatedAfter, locale) })}`
          : ""}
      </p>
    </div>
  );
}
