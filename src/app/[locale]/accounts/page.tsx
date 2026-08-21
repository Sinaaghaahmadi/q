import { Wallet } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import * as React from "react";
import { AccountsManager } from "@/components/accounts/accounts-manager";
import { EmptyState } from "@/components/layout/empty-state";
import { redirect } from "@/i18n/navigation";
import { createClient, getSessionProfile, isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "accounts" });
  return { title: t("metaTitle") };
}

export default async function AccountsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("accounts");

  if (!isSupabaseConfigured()) {
    return (
      <EmptyState
        icon={Wallet}
        title={t("unavailableTitle")}
        description={t("unavailableBody")}
        ctaLabel={t("backHome")}
      />
    );
  }

  const session = await getSessionProfile();
  if (!session?.user) {
    redirect({ href: "/signin?next=/accounts", locale });
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("beneficiary_accounts")
    .select("*")
    .is("archived_at", null)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  return (
    <div className="py-4">
      <AccountsManager initial={data ?? []} />
    </div>
  );
}
