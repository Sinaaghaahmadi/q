import { ShieldAlert, Users } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import * as React from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { UserDetail, type ReferralRow } from "@/components/admin/user-detail";
import { EmptyState } from "@/components/layout/empty-state";
import { LOGINS_SHOWN, ORDERS_SHOWN } from "@/lib/admin/filters";
import { redirect } from "@/i18n/navigation";
import { getAdminContext } from "@/lib/auth/admin-context";
import { can } from "@/lib/auth/can";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type {
  BeneficiaryAccount,
  LoginEvent,
  Order,
  Profile,
  Referral,
} from "@/lib/supabase/types";

/** The name of a counterparty, in the reader's language, or null when unnamed. */
type NamedProfile = Pick<Profile, "id" | "full_name_fa" | "full_name_latin">;

function displayName(profile: NamedProfile | undefined, locale: string): string | null {
  if (!profile) return null;
  return (
    (locale === "fa"
      ? (profile.full_name_fa ?? profile.full_name_latin)
      : (profile.full_name_latin ?? profile.full_name_fa)) ?? null
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });
  return { title: t("users.detailMetaTitle") };
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  if (!isSupabaseConfigured()) {
    return (
      <EmptyState
        icon={Users}
        hue="sky"
        title={t("unavailableTitle")}
        description={t("unavailableBody")}
        ctaLabel={t("backHome")}
      />
    );
  }

  const ctx = await getAdminContext();
  if (!ctx) redirect({ href: `/signin?next=/admin/users/${id}`, locale });
  if (!ctx || !can(ctx.seats, "platform.oversee")) {
    return (
      <EmptyState
        icon={ShieldAlert}
        hue="indigo"
        title={t("forbiddenTitle")}
        description={t("forbiddenBody")}
        ctaLabel={t("backHome")}
      />
    );
  }

  const supabase = await createClient();

  // A profile the policy refuses comes back empty, which is the same shape as
  // one that does not exist — and from here the two are the same answer (§15).
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!profile) notFound();

  const [
    { data: tier },
    { data: orders },
    { data: destinations },
    { data: logins },
    { data: invited },
    { data: invitedBy },
  ] = await Promise.all([
    supabase.rpc("customer_tier", { p_user: id }),
    supabase
      .from("orders")
      .select("*")
      .eq("customer_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(ORDERS_SHOWN),
    supabase.from("beneficiary_accounts").select("*").eq("user_id", id).is("deleted_at", null),
    supabase
      .from("login_events")
      .select("*")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(LOGINS_SHOWN),
    supabase
      .from("referrals")
      .select("*")
      .eq("referrer_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("referrals").select("*").eq("referee_id", id).maybeSingle(),
  ]);

  // Both sides of the referral table point at people, and a list of bare uuids
  // is no use to the agent reading this, so the names are resolved in one go.
  const counterparties = [
    ...(invited ?? []).map((row) => row.referee_id),
    ...(invitedBy ? [invitedBy.referrer_id] : []),
  ];
  const { data: named } = counterparties.length
    ? await supabase
        .from("profiles")
        .select("id, full_name_fa, full_name_latin")
        .in("id", counterparties)
    : { data: [] as NamedProfile[] };

  const byId = new Map((named ?? []).map((row) => [row.id, row]));

  const toRow = (row: Referral, otherId: string): ReferralRow => ({
    id: row.id,
    userId: otherId,
    name: displayName(byId.get(otherId), locale),
    code: row.code,
    rewardedAt: row.rewarded_at,
    createdAt: row.created_at,
  });

  const name = displayName(profile, locale);

  return (
    <AdminShell
      seats={ctx.seats}
      impersonation={ctx.impersonation}
      office={ctx.impersonatedOffice}
      title={name ?? t("users.unnamed")}
      description={profile.phone ?? profile.id}
    >
      <UserDetail
        profile={profile as Profile}
        tier={tier ?? null}
        orders={(orders ?? []) as Order[]}
        destinations={(destinations ?? []) as BeneficiaryAccount[]}
        logins={(logins ?? []) as LoginEvent[]}
        invited={(invited ?? []).map((row) => toRow(row, row.referee_id))}
        invitedBy={invitedBy ? toRow(invitedBy, invitedBy.referrer_id) : null}
        canFreeze={can(ctx.seats, "account.freeze")}
      />
    </AdminShell>
  );
}
