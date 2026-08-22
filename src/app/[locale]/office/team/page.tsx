import { Building2 } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import * as React from "react";
import { EmptyState } from "@/components/layout/empty-state";
import { OfficeShell } from "@/components/office/office-shell";
import { TeamView, type SeatRow } from "@/components/office/team-view";
import { redirect } from "@/i18n/navigation";
import { can, officeScopes } from "@/lib/auth/can";
import { createClient, getSessionProfile, isSupabaseConfigured } from "@/lib/supabase/server";
import type { ExchangeOffice, Membership } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "officePanel.team" });
  return { title: t("metaTitle") };
}

export default async function OfficeTeamPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("officePanel.team");
  const shell = await getTranslations("officePanel");

  if (!isSupabaseConfigured()) {
    return (
      <EmptyState
        icon={Building2}
        title={shell("unavailableTitle")}
        description={shell("unavailableBody")}
        ctaLabel={shell("backHome")}
      />
    );
  }

  const session = await getSessionProfile();
  if (!session?.user) {
    redirect({ href: "/signin?next=/office/team", locale });
  }

  const seats = session?.memberships ?? [];
  const officeId = officeScopes(seats)[0];
  if (!officeId) {
    return (
      <EmptyState
        icon={Building2}
        title={shell("notAMemberTitle")}
        description={shell("notAMemberBody")}
        ctaLabel={shell("backHome")}
      />
    );
  }

  const supabase = await createClient();
  const [{ data: office }, { data: members }] = await Promise.all([
    supabase.from("exchange_offices").select("*").eq("id", officeId).maybeSingle(),
    supabase
      .from("memberships")
      .select("*")
      .eq("scope_type", "office")
      .eq("scope_id", officeId)
      .is("deleted_at", null)
      .order("created_at"),
  ]);

  const rows = (members ?? []) as Membership[];
  const userIds = [...new Set(rows.map((row) => row.user_id))];

  // `profiles_self_read` hands an office member their own profile and nobody
  // else's, so most of these come back empty and the table falls back to the
  // user id. That is the policy working, not a missing join.
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, full_name_fa, full_name_latin").in("id", userIds)
    : { data: [] };

  const names = new Map(
    (profiles ?? []).map((profile) => [
      profile.id,
      (locale === "fa"
        ? (profile.full_name_fa ?? profile.full_name_latin)
        : (profile.full_name_latin ?? profile.full_name_fa)) ?? null,
    ]),
  );

  const team: SeatRow[] = rows
    .filter((row): row is Membership & { role: SeatRow["role"] } => row.role.startsWith("office_"))
    .map((row) => ({
      id: row.id,
      userId: row.user_id,
      role: row.role,
      since: row.created_at,
      name: names.get(row.user_id) ?? null,
    }));

  return (
    <OfficeShell
      office={(office ?? null) as ExchangeOffice | null}
      locale={locale}
      title={t("title")}
      description={t("subtitle")}
    >
      <TeamView
        officeId={officeId}
        members={team}
        canManage={can(seats, "office.team", officeId)}
        viewerId={session!.user.id}
      />
    </OfficeShell>
  );
}
