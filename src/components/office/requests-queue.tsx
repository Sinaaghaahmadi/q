"use client";

import { CircleAlert, HandCoins, X } from "lucide-react";
import { useFormatter, useLocale, useNow, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { Link } from "@/i18n/navigation";
import { formatAmount, type AppLocale } from "@/lib/money/format";
import { fromMinor } from "@/lib/money/minor";
import { nextAction } from "@/lib/office/steps";
import { stateTone } from "@/lib/orders/flow";
import type { CurrencyCode } from "@/lib/rates/catalog";
import { createClient } from "@/lib/supabase/client";
import type { Order } from "@/lib/supabase/types";

/** Long enough in one state that the wait itself is worth noticing. */
const STALE_AFTER_MS = 2 * 60 * 60 * 1000;

/**
 * The dense sibling of کار امروز.
 *
 * /office shows one job at a time on purpose — it is written for the person who
 * wants to be told what to press. This screen is written for the same person on
 * a busy morning, when the question is not "what next" but "which of these
 * eleven first". So: a row per request, sorted oldest-wait first, and two
 * filters — the corridor they are set up to serve, and whether the request is
 * actually theirs to move.
 *
 * Customers appear as a reference, not a name: `profiles_self_read` hands an
 * office its own members' rows and nothing else, so no name is reachable from
 * here for anyone. The first segment of the id is what the office can honestly
 * show, and it is the same reference the customers screen is searched by.
 *
 * Claiming is a race two offices can enter at the same instant. `order_claim`
 * settles it under a row lock, and the loser is told plainly rather than left
 * pressing a button that quietly does nothing.
 */
export function RequestsQueue({
  officeId,
  orders,
  customer,
}: {
  officeId: string;
  orders: Order[];
  /** Set when the list was opened from one customer's row, so it can say so. */
  customer?: string | null;
}) {
  const t = useTranslations("officePanel.requests");
  const states = useTranslations("orders.state");
  const locale = useLocale() as AppLocale;
  const format = useFormatter();
  /* An explicit `now`, so "seven minutes ago" is measured against a moment
     both sides of the render agree on. Left to itself next-intl reaches
     for the environment's clock and says so on the console, once per
     row. It ticks every minute, which is the granularity shown. */
  const now = useNow({ updateInterval: 60_000 });
  const router = useRouter();

  const [scope, setScope] = React.useState<"all" | "action">("all");
  const [corridor, setCorridor] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const corridors = [...new Set(orders.map((o) => o.corridor))].sort();
  const shown = orders.filter(
    (order) =>
      (corridor === "" || order.corridor === corridor) &&
      (scope === "all" || nextAction(order.state) !== null),
  );

  async function claim(order: Order) {
    setBusy(order.id);
    setError(null);
    try {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc("order_claim", {
        p_order: order.id,
        p_office: officeId,
      });

      if (rpcError) {
        // Both "already claimed" and "not matching" mean the row is spent:
        // somebody else took it, or it expired or was cancelled under the
        // operator. Neither is a failure to retry, so each says what happened
        // and takes the row off the screen in the same breath.
        const claimed = /already claimed/i.test(rpcError.message);
        const gone = /not matching/i.test(rpcError.message);
        setError(
          claimed
            ? t("errors.alreadyClaimed")
            : gone
              ? t("errors.gone")
              : /not active/i.test(rpcError.message)
                ? t("errors.inactive")
                : t("errors.failed"),
        );
        if (claimed || gone) router.refresh();
        return;
      }
      router.refresh();
    } catch {
      // A dropped connection rejects rather than returning an error, and this
      // panel is used on patchy phone data more often than not.
      setError(t("errors.network"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          value={scope}
          onChange={setScope}
          label={t("scopeLabel")}
          options={[
            { value: "all", label: t("scope.all") },
            { value: "action", label: t("scope.action") },
          ]}
        />
        <label className="text-sm text-ink-600">
          <span className="me-2">{t("corridorLabel")}</span>
          <select
            value={corridor}
            onChange={(e) => setCorridor(e.target.value)}
            className="h-10 rounded-xl border border-ink-300 bg-surface px-3 text-sm text-ink-900 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/25 focus:outline-none"
          >
            <option value="">{t("allCorridors")}</option>
            {corridors.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Opened from the customers page rather than from the queue itself:
          this is one person's whole history at this office, settled work
          included, and a list that looked like the ordinary queue would be
          read as "nothing is waiting". */}
      {customer ? (
        <Link
          href="/office/requests"
          className="glass-control pressable inline-flex items-center gap-1.5 self-start rounded-full px-3 py-1.5 text-sm font-medium text-brand-700 [--glass-tint:var(--brand-600)] dark:text-brand-600"
        >
          {t("narrowCustomer", { ref: customer.slice(0, 8) })}
          <X className="size-3.5" aria-hidden />
          <span className="sr-only">{t("clearCustomer")}</span>
        </Link>
      ) : null}

      {error ? (
        <p className="flex items-start gap-1.5 rounded-xl bg-down/12 p-3 text-sm text-down-ink">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}

      {shown.length === 0 ? (
        <Card className="p-10 text-center text-sm text-ink-600">
          {orders.length === 0 ? t("empty") : t("emptyFiltered")}
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="border-b border-ink-300/40 text-xs text-ink-600">
              <tr>
                <th className="px-4 py-3 text-start font-medium">{t("col.corridor")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("col.amount")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("col.customer")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("col.waiting")}</th>
                <th className="px-4 py-3 text-end font-medium">{t("col.action")}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((order) => {
                const send = order.send_currency as CurrencyCode;
                const since = new Date(order.state_since);
                const stale = Date.now() - since.getTime() > STALE_AFTER_MS;
                const unclaimed = order.office_id === null;

                return (
                  <tr key={order.id} className="border-b border-ink-300/25 last:border-0">
                    <td className="px-4 py-3">
                      <span className="num font-mono text-xs" dir="ltr">
                        {order.corridor}
                      </span>
                      <Link
                        href={`/orders/${order.id}`}
                        className="num mt-0.5 block font-mono text-xs text-ink-600 hover:text-brand-700"
                        dir="ltr"
                      >
                        {order.public_ref}
                      </Link>
                    </td>
                    <td className="num px-4 py-3 font-semibold">
                      {formatAmount(fromMinor(order.send_amount_minor, send), send, locale)}{" "}
                      <span className="text-xs font-normal text-ink-600" dir="ltr">
                        {send}
                      </span>
                    </td>
                    <td className="num px-4 py-3">
                      <Link
                        href={`/office/requests?customer=${order.customer_id}`}
                        className="font-mono text-xs text-ink-600 hover:text-brand-700 dark:hover:text-brand-600"
                        dir="ltr"
                      >
                        {order.customer_id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="num px-4 py-3">
                      {stale ? (
                        <Badge variant="warn">{format.relativeTime(since, now)}</Badge>
                      ) : (
                        <span className="text-ink-600">{format.relativeTime(since, now)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-end">
                      {unclaimed ? (
                        <Button size="sm" disabled={busy === order.id} onClick={() => claim(order)}>
                          <HandCoins className="size-4" aria-hidden />
                          {busy === order.id ? t("working") : t("claim")}
                        </Button>
                      ) : (
                        <Badge variant={stateTone(order.state)}>{states(order.state)}</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
