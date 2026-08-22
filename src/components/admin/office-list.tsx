"use client";

import { Building2, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import type { ExchangeOffice } from "@/lib/supabase/types";

const STATUS_TONE = {
  draft: "neutral",
  active: "up",
  suspended: "warn",
  archived: "down",
} as const;

/** The office directory (§4.3 /admin/exchanges), newest first. */
export function OfficeList({
  offices,
  liveCounts,
}: {
  offices: ExchangeOffice[];
  liveCounts: Record<string, number>;
}) {
  const t = useTranslations("admin.exchanges");
  const locale = useLocale();

  return (
    <div className="space-y-4">
      <Button asChild>
        <Link href="/admin/exchanges?new=1">
          <Plus className="size-4" aria-hidden />
          {t("provision")}
        </Link>
      </Button>

      {offices.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <Building2 className="size-8 text-brand-600" aria-hidden />
          <p className="text-sm text-ink-600">{t("empty")}</p>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {offices.map((office) => (
            <li key={office.id}>
              <Card className="h-full p-5 transition-shadow hover:shadow-e2">
                <Link href={`/admin/exchanges/${office.id}`} className="block space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold">
                      {locale === "fa" ? office.legal_name_fa : office.legal_name_en}
                    </p>
                    <Badge variant={STATUS_TONE[office.status]}>
                      {t(`status.${office.status}`)}
                    </Badge>
                  </div>
                  <p className="font-mono text-xs text-ink-600" dir="ltr">
                    {office.slug} · {office.license_no}
                  </p>
                  <p className="text-sm text-ink-600">
                    {t("liveOrders", { count: liveCounts[office.id] ?? 0 })}
                  </p>
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
