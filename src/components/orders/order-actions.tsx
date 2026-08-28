"use client";

import { CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { FailedLegScene } from "@/components/brand/scenes/money";
import { actionsFor, needsReason } from "@/lib/orders/flow";
import { createClient } from "@/lib/supabase/client";
import type { OrderActorRole, OrderState } from "@/lib/supabase/types";

/**
 * The transitions this caller may make, as buttons.
 *
 * What is offered comes from the mirrored matrix in `lib/orders/flow`; what is
 * *allowed* is decided by `order_advance` in the database, which re-derives the
 * actor from auth.uid() and raises if this UI got it wrong. A failure here is
 * therefore a real answer, not a glitch, so it is shown rather than swallowed.
 */
export function OrderActions({
  orderId,
  state,
  role,
}: {
  orderId: string;
  state: OrderState;
  role: OrderActorRole | null;
}) {
  const t = useTranslations("orders");
  const router = useRouter();

  const [pending, setPending] = React.useState<OrderState | null>(null);
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const actions = actionsFor(role, state);
  if (actions.length === 0) {
    return <p className="text-sm text-ink-600">{t("noActions")}</p>;
  }

  const reasonRequired = actions.some(needsReason);

  async function advance(to: OrderState) {
    if (needsReason(to) && reason.trim().length < 3) return;
    setPending(to);
    setError(null);
    try {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc("order_advance", {
        p_order: orderId,
        p_to: to,
        p_reason: reason.trim() || null,
      });
      if (rpcError) {
        setError(messageFor(rpcError.message));
        return;
      }
      setReason("");
      router.refresh();
    } catch {
      setError(t("actionFailed"));
    } finally {
      setPending(null);
    }
  }

  /** Map the database's own words onto ours, and never invent a cause (§18). */
  function messageFor(raw: string): string {
    if (/identity is not verified/i.test(raw)) return t("errors.notVerified");
    if (/no destination account/i.test(raw)) return t("errors.noDestination");
    if (/locked rate has expired/i.test(raw)) return t("errors.rateExpired");
    if (/may not move an order|not a party/i.test(raw)) return t("errors.notPermitted");
    if (/refunded, never cancelled/i.test(raw)) return t("errors.funded");
    return t("actionFailed");
  }

  return (
    <div className="space-y-3">
      {reasonRequired ? (
        <div>
          <label htmlFor="order-reason" className="text-sm font-medium">
            {t("reasonRequired")}
          </label>
          <textarea
            id="order-reason"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-2 w-full rounded-xl border border-ink-300 bg-surface p-3 text-sm focus:border-brand-600 focus:ring-2 focus:ring-brand-600/25 focus:outline-none"
          />
        </div>
      ) : null}

      {/* The money has left and the recipient has not confirmed: if something
          went wrong, this is where it gets said. */}
      {state === "foreign_leg_sent" && actions.includes("disputed") ? (
        <FailedLegScene size={84} className="mx-auto" />
      ) : null}

      <div className="flex flex-wrap gap-2">
        {actions.map((to) => (
          <Button
            key={to}
            variant={to === "cancelled" || to === "disputed" ? "secondary" : "primary"}
            disabled={pending !== null || (needsReason(to) && reason.trim().length < 3)}
            onClick={() => advance(to)}
          >
            {pending === to ? t("working") : t(`act.${to}`)}
          </Button>
        ))}
      </div>

      {error ? (
        <p className="flex items-start gap-1.5 text-sm text-down">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
