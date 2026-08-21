import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import * as React from "react";
import { SignInForm } from "@/components/auth/sign-in-form";
import { getSessionProfile, isSupabaseConfigured } from "@/lib/supabase/server";
import { redirect } from "@/i18n/navigation";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return { title: t("metaTitle") };
}

export default async function SignInPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;

  if (isSupabaseConfigured()) {
    const session = await getSessionProfile();
    if (session?.user) {
      redirect({ href: "/profile", locale });
    }
  }

  const next = typeof sp.next === "string" && sp.next.startsWith("/") ? sp.next : "/verify";

  return (
    <div className="py-6">
      <SignInForm nextPath={next} />
    </div>
  );
}
