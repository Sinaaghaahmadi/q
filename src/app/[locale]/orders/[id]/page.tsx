import { Compass } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import * as React from "react";
import { CoinIcon } from "@/components/brand/coin";
import { EmptyState } from "@/components/layout/empty-state";
import { OrderChat } from "@/components/chat/order-chat";
import { CostComparison } from "@/components/orders/cost-comparison";
import { ShareStatus } from "@/components/orders/share-status";
import { OrderActions } from "@/components/orders/order-actions";
import { OrderTimeline } from "@/components/orders/order-timeline";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { redirect } from "@/i18n/navigation";
import { formatAmount, formatDate, formatNumber, type AppLocale } from "@/lib/money/format";
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
  return { title: t("title") };
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("orders");
  const appLocale = (await getLocale()) as AppLocale;

  if (!isSupabaseConfigured()) {
    return <EmptyState icon={Compass} title={t("notFound")} description={t("emptyBody")} />;
  }

  const session = await getSessionProfile();
  if (!session?.user) {
    redirect({ href: `/signin?next=/orders/${id}`, locale });
  }

  const supabase = await createClient();

  // RLS answers "may this caller see it?" — a stranger's order simply comes
  // back empty, which is the same shape as one that does not exist (§15).
  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!order) {
    return <EmptyState icon={Compass} title={t("notFound")} description={t("emptyBody")} />;
  }

  const [{ data: events }, { data: role }, { data: office }] =
    await Promise.all([
      // Insertion order, not created_at: events written in one transaction
      // share a timestamp (submitting also routes), and a timeline that can
      // render them backwards is worse than no timeline.
      supabase.from("order_events").select("*").eq("order_id", id).order("seq"),
      supabase.rpc("order_actor_role", { p_order: id }),
      order.office_id
        ? supabase.from("exchange_offices").select("*").eq("id", order.office_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const send = order.send_currency as CurrencyCode;
  const receive = order.receive_currency as CurrencyCode;

  return (
    <div className="mx-auto max-w-2xl space-y-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="num font-mono text-xl font-bold" dir="ltr">
            {order.public_ref}
          </h1>
          <p className="num mt-1 text-xs text-ink-600">
            {t("created")} · {formatDate(order.created_at, appLocale, { dateStyle: "long" })}
          </p>
        </div>
        <Badge variant={stateTone(order.state)}>{t(`state.${order.state}`)}</Badge>
      </div>

      <Card className="p-5">
        <p className="text-sm leading-relaxed text-ink-600">{t(`stateBody.${order.state}`)}</p>
      </Card>

      {/* The two legs */}
      <Card className="divide-y divide-ink-300/40">
        <Row
          label={t("youSend")}
          coin={send}
          value={`${formatAmount(fromMinor(order.send_amount_minor, send), send, appLocale)} ${send}`}
        />
        <Row
          label={t("recipientGets")}
          coin={receive}
          value={`${formatAmount(fromMinor(order.receive_amount_minor, receive), receive, appLocale)} ${receive}`}
        />
        <Row
          label={t("rateLocked")}
          value={formatNumber(Number(order.locked_rate), appLocale, {
            maximumFractionDigits: 0,
          })}
        />
        <Row
          label={t("fees")}
          value={formatNumber(
            fromMinor(order.platform_fee_minor + order.office_fee_minor, "IRT"),
            appLocale,
          )}
        />
        <Row
          label={t("office")}
          value={
            office
              ? appLocale === "fa"
                ? office.legal_name_fa
                : office.legal_name_en
              : t("officeUnassigned")
          }
        />
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="text-sm font-semibold">{t("actions")}</h2>
        <OrderActions orderId={order.id} state={order.state} role={role ?? null} />
      </Card>

      {order.state === "completed" ? (
        <CostComparison order={order} />
      ) : null}

      <ShareStatus publicRef={order.public_ref} />

      <OrderChat
        orderId={order.id}
        state={order.state}
        role={role ?? null}
        viewerId={session!.user.id}
        locale={locale}
      />

      <Card className="space-y-4 p-5">
        <h2 className="text-sm font-semibold">{t("timeline")}</h2>
        <OrderTimeline events={events ?? []} />
      </Card>
    </div>
  );
}

function Row({ label, value, coin }: { label: string; value: string; coin?: CurrencyCode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3.5">
      <span className="text-sm text-ink-600">{label}</span>
      <span className="num inline-flex items-center gap-2 text-sm font-semibold">
        {coin ? <CoinIcon code={coin} size={22} /> : null}
        {value}
      </span>
    </div>
  );
}
