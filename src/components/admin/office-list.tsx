"use client";

import { Building2, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { OfficeLogo, officeLogoUrl } from "@/components/office/office-logo";
import { AppTile } from "@/components/brand/app-tile";
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
          <AppTile hue="slate" size="lg">
            <Building2 />
          </AppTile>
          <p className="text-sm text-ink-600">{t("empty")}</p>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {offices.map((office) => (
            <li key={office.id}>
              <Card className="h-full p-5 transition-shadow hover:shadow-e2">
                <Link href={`/admin/exchanges/${office.id}`} className="block space-y-2">
                  <div className="flex items-start gap-3">
                    <OfficeLogo
                      name={office.display_name ?? office.legal_name_fa}
                      logoUrl={officeLogoUrl(office.logo_path)}
                      officeId={office.id}
                      size={40}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">
                        {office.display_name ??
                          (locale === "fa" ? office.legal_name_fa : office.legal_name_en)}
                      </p>
                      <p className="truncate font-mono text-xs text-ink-600" dir="ltr">
                        {office.slug} · {office.license_no}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge variant={STATUS_TONE[office.status]}>
                        {t(`status.${office.status}`)}
                      </Badge>
                      {office.kyc_state !== "verified" ? (
                        <Badge variant={office.kyc_state === "rejected" ? "down" : "warn"}>
                          {t(`kyc.${office.kyc_state}`)}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
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
