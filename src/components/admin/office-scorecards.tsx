import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { formatAmount, formatNumber, type AppLocale } from "@/lib/money/format";
import { fromMinor } from "@/lib/money/minor";

export type OfficeScore = {
  officeId: string;
  nameFa: string;
  nameEn: string;
  orders: number;
  volumeMinor: number;
  /** null until at least one order has both opened and settled. */
  averageMinutes: number | null;
  /** null when no settled order carried a deadline to be judged against. */
  sla: { measured: number; onTime: number } | null;
  /** null for an office that has not been handed anything yet. */
  disputeRate: number | null;
};

/**
 * Thresholds for the colour only. The share itself is the fact and is always
 * printed; the tone exists so a row that needs a conversation can be found
 * without reading twelve numbers.
 */
function slaTone(share: number): "up" | "warn" | "down" {
  return share >= 0.95 ? "up" : share >= 0.85 ? "warn" : "down";
}

function disputeTone(rate: number): "up" | "warn" | "down" {
  return rate === 0 ? "up" : rate <= 0.02 ? "warn" : "down";
}

/**
 * How each active office is actually doing (§17.6).
 *
 * This is the table an ops lead reads before deciding who gets first refusal on
 * the next request, so it is sorted by the money and not by the alphabet, and
 * every column is one question: how much did they carry, how fast, did they
 * make the deadline, and how often did it end in an argument. An office with no
 * orders still gets a row — an active office sitting idle is exactly the thing
 * a sorted-by-volume table would otherwise hide at the bottom of the page.
 */
export function OfficeScorecards({ scores }: { scores: OfficeScore[] }) {
  const t = useTranslations("admin.dashboard");
  const locale = useLocale() as AppLocale;

  const share = (value: number) =>
    formatNumber(value, locale, { style: "percent", maximumFractionDigits: 0 });

  const duration = (minutes: number) =>
    minutes >= 90
      ? t("hours", { value: formatNumber(minutes / 60, locale, { maximumFractionDigits: 1 }) })
      : t("minutes", { value: formatNumber(Math.round(minutes), locale) });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("scoreTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {scores.length === 0 ? (
          <p className="text-sm text-ink-600">{t("scoreEmpty")}</p>
        ) : (
          <>
            <div className="-mx-6 overflow-x-auto px-6">
              <table className="w-full min-w-[42rem] text-sm">
                <thead className="border-b border-ink-300/40 text-xs text-ink-600">
                  <tr>
                    <th className="py-2 pe-3 text-start font-medium">{t("col.office")}</th>
                    <th className="px-3 py-2 text-end font-medium">{t("col.orders")}</th>
                    <th className="px-3 py-2 text-end font-medium">{t("col.volume")}</th>
                    <th className="px-3 py-2 text-end font-medium">{t("col.completion")}</th>
                    <th className="px-3 py-2 text-end font-medium">{t("col.sla")}</th>
                    <th className="py-2 ps-3 text-end font-medium">{t("col.disputes")}</th>
                  </tr>
                </thead>
                <tbody>
                  {scores.map((score) => (
                    <tr key={score.officeId} className="border-b border-ink-300/25 last:border-0">
                      <td className="py-3 pe-3">
                        <Link
                          href={`/admin/exchanges/${score.officeId}`}
                          className="font-medium hover:text-brand-700"
                        >
                          {locale === "fa" ? score.nameFa : score.nameEn}
                        </Link>
                      </td>
                      <td className="num px-3 py-3 text-end">
                        {score.orders === 0 ? (
                          <span className="text-ink-600">{t("noOrders")}</span>
                        ) : (
                          formatNumber(score.orders, locale)
                        )}
                      </td>
                      <td className="num px-3 py-3 text-end">
                        {formatAmount(fromMinor(score.volumeMinor, "IRT"), "IRT", locale)}
                      </td>
                      <td className="num px-3 py-3 text-end text-ink-600">
                        {score.averageMinutes === null
                          ? t("noData")
                          : duration(score.averageMinutes)}
                      </td>
                      <td className="px-3 py-3 text-end">
                        {score.sla === null ? (
                          <span className="text-ink-600">{t("noData")}</span>
                        ) : (
                          <Badge variant={slaTone(score.sla.onTime / score.sla.measured)}>
                            <span className="num">
                              {share(score.sla.onTime / score.sla.measured)}
                            </span>
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 ps-3 text-end">
                        {score.disputeRate === null ? (
                          <span className="text-ink-600">{t("noData")}</span>
                        ) : (
                          <Badge variant={disputeTone(score.disputeRate)}>
                            <span className="num">
                              {formatNumber(score.disputeRate, locale, {
                                style: "percent",
                                maximumFractionDigits: 1,
                              })}
                            </span>
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs leading-relaxed text-ink-600">{t("scoreHint")}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
