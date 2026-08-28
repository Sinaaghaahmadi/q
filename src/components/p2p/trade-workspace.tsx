"use client";

import { CircleAlert, ShieldCheck, Star } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { formatAmount, formatNumber, type AppLocale } from "@/lib/money/format";
import { fromMinor } from "@/lib/money/minor";
import { stateTone } from "@/lib/orders/flow";
import type { CurrencyCode } from "@/lib/rates/catalog";
import { createClient } from "@/lib/supabase/client";
import type { ExchangeOffice, Order, P2pTrade } from "@/lib/supabase/types";

/**
 * A trade's workspace. Almost everything visible here belongs to the *order* —
 * that is §9's design working: the trade contributes the counterparty and the
 * rating, and the supervised settlement is the same machine a brokered transfer
 * uses, right down to the timeline link.
 */
export function TradeWorkspace({
  trade,
  order,
  office,
  viewerId,
}: {
  trade: P2pTrade;
  order: Order | null;
  office: ExchangeOffice | null;
  viewerId: string;
}) {
  const t = useTranslations("p2p.trade");
  const states = useTranslations("orders.state");
  const locale = useLocale() as AppLocale;
  const router = useRouter();

  const [reason, setReason] = React.useState("");
  const [score, setScore] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const iAmMaker = trade.maker_id === viewerId;
  const canDispute =
    order !== null && !["completed", "cancelled", "refunded", "expired"].includes(order.state);

  async function dispute() {
    setBusy(true);
    setError(null);
    const { error: rpcError } = await createClient().rpc("p2p_trade_dispute", {
      p_trade: trade.id,
      p_reason: reason.trim(),
    });
    setBusy(false);
    if (rpcError) {
      setError(/written reason/i.test(rpcError.message) ? t("reasonRequired") : t("failed"));
      return;
    }
    setReason("");
    router.refresh();
  }

  async function rate(value: number) {
    setBusy(true);
    setError(null);
    const { error: rpcError } = await createClient().rpc("p2p_rate", {
      p_trade: trade.id,
      p_score: value,
    });
    setBusy(false);
    if (rpcError) {
      setError(/already|duplicate/i.test(rpcError.message) ? t("alreadyRated") : t("failed"));
      return;
    }
    setScore(value);
    router.refresh();
  }

  return (
    <>
      <Card className="space-y-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">{t("title")}</h1>
            <p className="mt-1 text-sm text-ink-600">
              {iAmMaker ? t("youAreMaker") : t("youAreTaker")}
            </p>
          </div>
          {order ? <Badge variant={stateTone(order.state)}>{states(order.state)}</Badge> : null}
        </div>

        {order ? (
          <dl className="space-y-2 text-sm">
            <Row
              label={t("tomanLeg")}
              value={`${formatAmount(fromMinor(order.send_amount_minor, "IRT"), "IRT", locale)} IRT`}
            />
            <Row
              label={t("foreignLeg")}
              value={`${formatAmount(
                fromMinor(order.receive_amount_minor, order.receive_currency as CurrencyCode),
                order.receive_currency as CurrencyCode,
                locale,
              )} ${order.receive_currency}`}
            />
            <Row
              label={t("agreedRate")}
              value={formatNumber(Number(trade.agreed_rate), locale, { maximumFractionDigits: 0 })}
            />
            <Row
              label={t("escrowOffice")}
              value={
                office
                  ? locale === "fa"
                    ? office.legal_name_fa
                    : office.legal_name_en
                  : t("noEscrow")
              }
            />
          </dl>
        ) : null}

        <p className="flex items-start gap-1.5 text-sm text-ink-600">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-up" aria-hidden />
          {t("escrowExplainer")}
        </p>

        {order ? (
          <Button variant="secondary" asChild>
            <Link href={`/orders/${order.id}`}>{t("openOrder")}</Link>
          </Button>
        ) : null}
      </Card>

      {trade.state === "completed" ? (
        <Card className="space-y-3 p-6">
          <h2 className="text-sm font-semibold">{t("rateTitle")}</h2>
          <p className="text-sm text-ink-600">{t("rateBody")}</p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                disabled={busy}
                onClick={() => rate(value)}
                aria-label={t("stars", { count: value })}
                className="pressable rounded-lg p-1.5 hover:bg-ink-300/25"
              >
                <Star
                  className={`size-6 ${value <= score ? "fill-current text-warn" : "text-ink-300"}`}
                  aria-hidden
                />
              </button>
            ))}
          </div>
        </Card>
      ) : null}

      {canDispute ? (
        <Card className="space-y-3 p-6">
          <h2 className="text-sm font-semibold">{t("disputeTitle")}</h2>
          <p className="text-sm text-ink-600">{t("disputeBody")}</p>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("disputePlaceholder")}
            aria-label={t("disputeTitle")}
          />
          <Button
            variant="destructive"
            disabled={busy || reason.trim().length < 8}
            onClick={dispute}
          >
            {t("raiseDispute")}
          </Button>
        </Card>
      ) : null}

      {error ? (
        <p className="flex items-start gap-1.5 text-sm text-down">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-ink-300/40 pb-2 last:border-0">
      <dt className="text-ink-600">{label}</dt>
      <dd className="num text-end font-medium">{value}</dd>
    </div>
  );
}
