import { Percent, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import * as React from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  RatesAdmin,
  type CorridorSpread,
  type OfficeRef,
  type SpreadBounds,
} from "@/components/admin/rates-admin";
import { EmptyState } from "@/components/layout/empty-state";
import { SPREAD_BOUNDS_KEY } from "@/lib/admin/filters";
import { redirect } from "@/i18n/navigation";
import { getAdminContext } from "@/lib/auth/admin-context";
import { can } from "@/lib/auth/can";
import { getSnapshot } from "@/lib/rates/service";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { ExchangeOffice, Json, OfficeRateConfig, RateSource } from "@/lib/supabase/types";

type ConfigRow = Pick<OfficeRateConfig, "office_id" | "corridor" | "spread_bps">;
type OfficeRow = Pick<ExchangeOffice, "id" | "legal_name_fa" | "legal_name_en">;

/**
 * The stored row is written by hand and by us, so it is read defensively:
 * anything that is not two whole numbers in the right order is treated as
 * absent, which the screen then says out loud instead of enforcing a range
 * nobody can explain.
 */
function readBounds(value: Json | undefined | null): SpreadBounds | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const floor = value.floor_bps;
  const ceiling = value.ceiling_bps;
  if (typeof floor !== "number" || typeof ceiling !== "number") return null;
  if (!Number.isInteger(floor) || !Number.isInteger(ceiling)) return null;
  if (floor < 0 || ceiling <= floor) return null;
  return { floor_bps: floor, ceiling_bps: ceiling };
}

/** Middle value of an ascending list; the mean of the middle pair when even. */
function median(values: number[]): number {
  const mid = values.length >> 1;
  const upper = values[mid] ?? 0;
  return values.length % 2 === 1 ? upper : ((values[mid - 1] ?? upper) + upper) / 2;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.rates" });
  return { title: t("metaTitle") };
}

export default async function AdminRatesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin.rates");
  const shell = await getTranslations("admin");

  if (!isSupabaseConfigured()) {
    return (
      <EmptyState
        icon={Percent}
        title={shell("unavailableTitle")}
        description={shell("unavailableBody")}
        ctaLabel={shell("backHome")}
      />
    );
  }

  const ctx = await getAdminContext();
  if (!ctx) redirect({ href: "/signin?next=/admin/rates", locale });
  if (!ctx || !can(ctx.seats, "platform.config")) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title={shell("forbiddenTitle")}
        description={shell("forbiddenBody")}
        ctaLabel={shell("backHome")}
      />
    );
  }

  const supabase = await createClient();

  // The snapshot comes from the service, not from `/api/rates`. The route
  // handler is a thin JSON wrapper over this same in-process cache, so calling
  // it over HTTP would need an absolute origin, cost a round trip, and could
  // still only return what `getSnapshot()` already holds.
  const [snapshot, { data: sourceRows }, { data: settingRow }, { data: configRows }] =
    await Promise.all([
      getSnapshot(),
      supabase.from("rate_sources").select("*").is("deleted_at", null).order("name"),
      supabase.from("settings").select("*").eq("key", SPREAD_BOUNDS_KEY).maybeSingle(),
      // Inactive corridors are left out: they quote nothing, so a spread parked
      // on one is not a price anybody can be given.
      supabase
        .from("office_rate_config")
        .select("office_id, corridor, spread_bps")
        .eq("active", true)
        .is("deleted_at", null),
    ]);

  // Only offices that are actually quoting: provisioning writes the rate rows
  // while the office is still `draft`, so an office that was created and never
  // activated would otherwise hold the lowest or highest spread on a corridor
  // and be named for a price nobody can be given.
  const { data: officeRows } = await supabase
    .from("exchange_offices")
    .select("id, legal_name_fa, legal_name_en")
    .eq("status", "active")
    .is("deleted_at", null);

  const offices = new Map(
    ((officeRows ?? []) as OfficeRow[]).map((office) => [
      office.id,
      { id: office.id, nameFa: office.legal_name_fa, nameEn: office.legal_name_en } as OfficeRef,
    ]),
  );

  const byCorridor = new Map<string, ConfigRow[]>();
  for (const row of (configRows ?? []) as ConfigRow[]) {
    if (!offices.has(row.office_id)) continue;
    const held = byCorridor.get(row.corridor);
    if (held) held.push(row);
    else byCorridor.set(row.corridor, [row]);
  }

  // Parsed once so the screen cannot say "nothing is stored" beside the row's
  // own timestamp: an unreadable value is still a value the form will replace.
  const bounds = readBounds(settingRow?.value);

  const corridors: CorridorSpread[] = [...byCorridor]
    .map(([corridor, rows]) => {
      const sorted = [...rows].sort((a, b) => a.spread_bps - b.spread_bps);
      const lowest = sorted[0];
      const highest = sorted[sorted.length - 1];
      return {
        corridor,
        offices: sorted.length,
        minBps: lowest?.spread_bps ?? 0,
        medianBps: median(sorted.map((row) => row.spread_bps)),
        maxBps: highest?.spread_bps ?? 0,
        lowest: lowest ? (offices.get(lowest.office_id) ?? null) : null,
        highest: highest ? (offices.get(highest.office_id) ?? null) : null,
      };
    })
    .sort((a, b) => a.corridor.localeCompare(b.corridor));

  return (
    <AdminShell
      seats={ctx.seats}
      impersonation={ctx.impersonation}
      office={ctx.impersonatedOffice}
      title={t("title")}
      description={t("subtitle")}
    >
      <RatesAdmin
        snapshot={snapshot}
        sources={(sourceRows ?? []) as RateSource[]}
        bounds={bounds}
        boundsStored={settingRow != null}
        boundsUpdatedAt={settingRow?.updated_at ?? null}
        corridors={corridors}
      />
    </AdminShell>
  );
}
