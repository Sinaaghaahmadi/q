import { setRequestLocale } from "next-intl/server";
import * as React from "react";

/**
 * Every `/admin` screen reads the caller's seats and their live impersonation
 * before it renders, which makes them all dynamic. Declaring it once here keeps
 * the individual pages from each having to remember.
 */
export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return children;
}
