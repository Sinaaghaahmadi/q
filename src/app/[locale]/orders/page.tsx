import { ReceiptText } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import * as React from "react";
import { PageHeading } from "@/components/brand/app-tile";
import { CoinIcon } from "@/components/brand/coin";
import { EmptyState } from "@/components/layout/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Link, redirect } from "@/i18n/navigation";
import { formatAmount, formatDate, type AppLocale } from "@/lib/money/format";
import { fromMinor } from "@/lib/money/minor";
import { stateTone } from "@/lib/orders/flow";
import type { CurrencyCode } from "@/lib/rates/catalog";
import { createClient, getSessionProfile, isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

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
  const appLocale = (await getLocale()) as AppLocale;

  const empty = (
    <EmptyState
      icon={ReceiptText}
      hue="brand"
      title={t("emptyTitle")}
      description={t("emptyBody")}
      ctaLabel={t("cta")}
      ctaHref="/transfer/new"
    />
  );

  if (!isSupabaseConfigured()) return empty;

  const session = await getSessionProfile();
  if (!session?.user) {
    redirect({ href: "/signin?next=/orders", locale });
  }

  const supabase = await createClient();
  // RLS decides the rows: a customer's own, an office's claimed ones, or all
  // of them for platform staff. The query is the same either way.
  const { data: orders } = await supabase
    .from("orders")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  if (!orders || orders.length === 0) return empty;

  return (
    <div className="space-y-5 py-4">
      <PageHeading hue="brand" icon={<ReceiptText />} title={t("title")} subtitle={t("subtitle")} />

      <div className="grid gap-3">
        {orders.map((order) => (
          <Link key={order.id} href={`/orders/${order.id}`}>
            <Card className="flex items-center gap-3 p-4 transition-shadow hover:shadow-e2">
              <CoinIcon code={order.send_currency as CurrencyCode} size={38} />
              <div className="min-w-0 flex-1">
                <p className="num truncate font-mono text-sm font-semibold" dir="ltr">
                  {order.public_ref}
                </p>
                <p className="num mt-0.5 truncate text-xs text-ink-600">
                  {formatDate(order.created_at, appLocale, { dateStyle: "medium" })}
                </p>
              </div>
              {/* A column rather than a fourth item in a wrapping row: at 412 px
                  the state badge pushed the reference and the date into a
                  sliver, and a Persian date in a sliver breaks one word to a
                  line. Amounts above, state under them, nothing wraps. */}
              <div className="flex shrink-0 flex-col items-end gap-1 text-end">
                <p className="num text-sm font-semibold whitespace-nowrap">
                  {formatAmount(
                    fromMinor(order.send_amount_minor, order.send_currency as CurrencyCode),
                    order.send_currency as CurrencyCode,
                    appLocale,
                  )}{" "}
                  <span className="text-xs font-normal text-ink-600" dir="ltr">
                    {order.send_currency}
                  </span>
                </p>
                <p className="num text-xs whitespace-nowrap text-ink-600">
                  →{" "}
                  {formatAmount(
                    fromMinor(order.receive_amount_minor, order.receive_currency as CurrencyCode),
                    order.receive_currency as CurrencyCode,
                    appLocale,
                  )}{" "}
                  <span dir="ltr">{order.receive_currency}</span>
                </p>
                <Badge variant={stateTone(order.state)} className="mt-0.5">
                  {t(`state.${order.state}`)}
                </Badge>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
