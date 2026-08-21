import { Compass } from "lucide-react";
import { getTranslations } from "next-intl/server";
import * as React from "react";
import { EmptyState } from "@/components/layout/empty-state";

export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <EmptyState icon={Compass} title={t("title")} description={t("body")} ctaLabel={t("cta")} />
  );
}
