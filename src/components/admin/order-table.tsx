"use client";

import { CircleAlert, Gavel } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { formatAmount, type AppLocale } from "@/lib/money/format";
import { fromMinor } from "@/lib/money/minor";
import { ALLOWED_TRANSITIONS, isTerminal, stateTone } from "@/lib/orders/flow";
import type { CurrencyCode } from "@/lib/rates/catalog";
import { createClient } from "@/lib/supabase/client";
import type { ExchangeOffice, Order, OrderState } from "@/lib/supabase/types";

/**
 * The ops escapes §16.4 names by name, on top of whatever the graph already
 * allows from here. They are offered separately in the picker so that reaching
 * for one is a deliberate act rather than a mis-click on a neighbouring option.
 */
const ESCAPES: OrderState[] = ["on_hold", "disputed", "cancelled", "refunded", "sla_breached"];

/** Every order, every office (§4.3), with the force-transition control. */
export function AdminOrderTable({
  orders,
  offices,
  canForce,
  activeState,
}: {
  orders: Order[];
  offices: Pick<ExchangeOffice, "id" | "legal_name_fa" | "legal_name_en">[];
  canForce: boolean;
  activeState: string | null;
}) {
  const t = useTranslations("admin.orders");
  const states = useTranslations("orders.state");
  const locale = useLocale() as AppLocale;
  const router = useRouter();

  const officeName = new Map(
    offices.map((o) => [o.id, locale === "fa" ? o.legal_name_fa : o.legal_name_en]),
  );

  const [open, setOpen] = React.useState<string | null>(null);
  const [target, setTarget] = React.useState<OrderState | "">("");
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const current = orders.find((o) => o.id === open) ?? null;
  const choices = current
    ? [...new Set([...ALLOWED_TRANSITIONS[current.state], ...ESCAPES])].filter(
        (s) => s !== current.state,
      )
    : [];

  async function force() {
    if (!current || !target || reason.trim().length < 8) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("order_force_transition", {
      p_order: current.id,
      p_to: target,
      p_reason: reason.trim(),
    });
    setBusy(false);
    if (rpcError) {
      setError(
        /written reason/i.test(rpcError.message)
          ? t("errors.reason")
          : /already/i.test(rpcError.message)
            ? t("errors.terminal")
            : /only a platform administrator/i.test(rpcError.message)
              ? t("errors.forbidden")
              : t("errors.failed"),
      );
      return;
    }
    setOpen(null);
    setTarget("");
    setReason("");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <FilterChip href="/admin/orders" label={t("all")} active={activeState === null} />
        {(["matching", "irt_funded", "disputed", "completed"] as OrderState[]).map((s) => (
          <FilterChip
            key={s}
            href={`/admin/orders?state=${s}`}
            label={states(s)}
            active={activeState === s}
          />
        ))}
      </div>

      {orders.length === 0 ? (
        <Card className="p-10 text-center text-sm text-ink-600">{t("empty")}</Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[46rem] text-sm">
            <thead className="border-b border-ink-300/40 text-start text-xs text-ink-600">
              <tr>
                <th className="px-4 py-3 text-start font-medium">{t("col.ref")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("col.corridor")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("col.amount")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("col.office")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("col.state")}</th>
                <th className="px-4 py-3 text-end font-medium">{t("col.action")}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-ink-300/25 last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/orders/${order.id}`}
                      className="font-mono text-xs hover:text-brand-700"
                      dir="ltr"
                    >
                      {order.public_ref}
                    </Link>
                    {order.origin === "admin_on_behalf" ? (
                      <Badge variant="info" className="ms-2">
                        {t("onBehalf")}
                      </Badge>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    <span dir="ltr">{order.corridor}</span>
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatAmount(
                      fromMinor(order.send_amount_minor, order.send_currency as CurrencyCode),
                      order.send_currency as CurrencyCode,
                      locale,
                    )}{" "}
                    {order.send_currency}
                  </td>
                  <td className="px-4 py-3 text-ink-600">
                    {order.office_id ? (officeName.get(order.office_id) ?? "—") : t("unclaimed")}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={stateTone(order.state)}>{states(order.state)}</Badge>
                  </td>
                  <td className="px-4 py-3 text-end">
                    {canForce && !isTerminal(order.state) ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setOpen(open === order.id ? null : order.id);
                          setTarget("");
                          setReason("");
                          setError(null);
                        }}
                      >
                        <Gavel className="size-4" aria-hidden />
                        {t("force")}
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {current ? (
        <Card className="space-y-3 p-5">
          <h2 className="font-semibold">{t("forceTitle", { ref: current.public_ref })}</h2>
          <p className="text-sm text-ink-600">{t("forceBody")}</p>

          <label className="block text-sm font-medium">
            {t("targetState")}
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value as OrderState)}
              className="mt-1.5 h-11 w-full rounded-xl border border-ink-300 bg-surface px-3 text-sm focus:border-brand-600 focus:ring-2 focus:ring-brand-600/25 focus:outline-none"
            >
              <option value="">—</option>
              {choices.map((s) => (
                <option key={s} value={s}>
                  {states(s)}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium">
            {t("reason")}
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-ink-300 bg-surface p-3 text-sm focus:border-brand-600 focus:ring-2 focus:ring-brand-600/25 focus:outline-none"
            />
          </label>

          <div className="flex gap-2">
            <Button
              variant="destructive"
              disabled={busy || !target || reason.trim().length < 8}
              onClick={force}
            >
              {busy ? t("working") : t("confirmForce")}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(null)}>
              {t("cancel")}
            </Button>
          </div>

          {error ? (
            <p className="flex items-start gap-1.5 text-sm text-down">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {error}
            </p>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}

function FilterChip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? "bg-brand-solid text-white" : "bg-ink-300/25 text-ink-600 hover:text-ink-900"
      }`}
    >
      {label}
    </Link>
  );
}
