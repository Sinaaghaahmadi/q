import { ReceiptText } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import * as React from "react";
import { EmptyState } from "@/components/layout/empty-state";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "orders" });
  return { title: t("metaTitle") };
}

export default async function OrdersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("orders");

  return (
    <EmptyState
      icon={ReceiptText}
      title={t("emptyTitle")}
      description={t("emptyBody")}
      phaseLabel={t("phase")}
      ctaLabel={t("cta")}
      ctaHref="/transfer/new"
    />
  );
}
