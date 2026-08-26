import { Building2 } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import * as React from "react";
import { EmptyState } from "@/components/layout/empty-state";
import { FirstEntry } from "@/components/office/first-entry";
import { OfficeShell } from "@/components/office/office-shell";
import { Today, type TodayJob } from "@/components/office/today";
import { redirect } from "@/i18n/navigation";
import { officeScopes } from "@/lib/auth/can";
import { createClient, getSessionProfile, isSupabaseConfigured } from "@/lib/supabase/server";
import type { BeneficiaryAccount, ExchangeOffice, Json, Order } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "officePanel" });
  return { title: t("metaTitle") };
}

/** Whatever this account looks like, reduced to one number a person can read out. */
function accountNumber(details: Json): string {
  if (details && typeof details === "object" && !Array.isArray(details)) {
    for (const key of ["iban", "number", "card", "sheba", "account"]) {
      const value = details[key];
      if (typeof value === "string" && value.length > 0) return value;
    }
  }
  return "—";
}

export default async function OfficeTodayPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("officePanel");

  if (!isSupabaseConfigured()) {
    return (
      <EmptyState
        icon={Building2}
        hue="slate"
        title={t("unavailableTitle")}
        description={t("unavailableBody")}
        ctaLabel={t("backHome")}
      />
    );
  }

  const session = await getSessionProfile();
  if (!session?.user) {
    redirect({ href: "/signin?next=/office", locale });
  }

  const supabase = await createClient();

  // An office arriving for the first time has no seat yet — the seat is what
  // claiming the invitation grants. So this is checked *before* the membership
  // gate, or the very people it exists for would be turned away by it.
  const { data: invitations } = await supabase.rpc("office_invitation_pending");
  const invitation = Array.isArray(invitations) ? invitations[0] : null;

  const scopes = officeScopes(session?.memberships ?? []);
  const officeId = scopes[0];

  if (!officeId) {
    if (invitation) {
      return (
        <div className="mx-auto w-full max-w-2xl py-6">
          <FirstEntry pendingInvitationId={invitation.id} />
        </div>
      );
    }
    return (
      <EmptyState
        icon={Building2}
        hue="indigo"
        title={t("notAMemberTitle")}
        description={t("notAMemberBody")}
        ctaLabel={t("backHome")}
      />
    );
  }
  const askPassword = session?.profile?.password_set_by_user === false;

  const [{ data: office }, { data: pool }, { data: mine }] = await Promise.all([
    supabase.from("exchange_offices").select("*").eq("id", officeId).maybeSingle(),
    // The matching-pool policy already limits this to members of an active
    // office, so an unclaimed order shows up here exactly when it may be taken.
    supabase
      .from("orders")
      .select("*")
      .is("office_id", null)
      .eq("state", "matching")
      .order("created_at")
      .limit(20),
    supabase.from("orders").select("*").eq("office_id", officeId).order("created_at").limit(100),
  ]);

  const orders = [...((pool ?? []) as Order[]), ...((mine ?? []) as Order[])];

  const customerIds = [...new Set(orders.map((o) => o.customer_id))];
  const destinationIds = [
    ...new Set(
      orders.map((o) => o.destination_account_id).filter((id): id is string => id !== null),
    ),
  ];

  const [{ data: profiles }, { data: accounts }] = await Promise.all([
    customerIds.length
      ? supabase.from("profiles").select("id, full_name_fa, full_name_latin").in("id", customerIds)
      : Promise.resolve({ data: [] }),
    // RLS hands back only the ones this office is currently meant to pay into.
    destinationIds.length
      ? supabase.from("beneficiary_accounts").select("*").in("id", destinationIds)
      : Promise.resolve({ data: [] as BeneficiaryAccount[] }),
  ]);

  const names = new Map(
    (profiles ?? []).map((p) => [
      p.id,
      (locale === "fa"
        ? (p.full_name_fa ?? p.full_name_latin)
        : (p.full_name_latin ?? p.full_name_fa)) ?? null,
    ]),
  );
  const destinations = new Map(
    ((accounts ?? []) as BeneficiaryAccount[]).map((a) => [
      a.id,
      {
        nickname: a.nickname,
        holder: a.holder_name,
        number: accountNumber(a.details),
        country: a.country,
      },
    ]),
  );

  const jobs: TodayJob[] = orders.map((order) => ({
    order,
    customerName: names.get(order.customer_id) ?? null,
    destination: order.destination_account_id
      ? (destinations.get(order.destination_account_id) ?? null)
      : null,
  }));

  return (
    <OfficeShell
      office={(office ?? null) as ExchangeOffice | null}
      locale={locale}
      title={t("title")}
      description={t("subtitle")}
    >
      {askPassword ? <FirstEntry /> : null}
      <Today officeId={officeId} jobs={jobs} />
    </OfficeShell>
  );
}
