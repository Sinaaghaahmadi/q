"use client";

import { Bell, BellOff, BellRing, CircleAlert, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { AppTile } from "@/components/brand/app-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { formatRate, toLatinDigits, type AppLocale } from "@/lib/money/format";
import { createClient } from "@/lib/supabase/client";
import type { CurrencyCode } from "@/lib/rates/catalog";

interface Alert {
  id: string;
  pair: string;
  direction: "above" | "below";
  threshold: number;
  active: boolean;
  last_fired_at: string | null;
}

/**
 * Standing questions about a price.
 *
 * The alert itself is a row the customer owns — `price_alerts_own` is a
 * `FOR ALL` policy on their own `user_id` — so this writes directly rather than
 * through an RPC. There is nothing to decide server-side that the policy does
 * not already decide, and a function in front of it would only be a place for
 * the two to disagree.
 *
 * What is *not* here is the firing. `price_alerts_evaluate` runs in the
 * database against recorded snapshots (migration 0029) and writes a
 * notification. A component that only checked while its tab was open would be
 * an alert that works when you are already looking, which is the one case where
 * you do not need one.
 */
export function AlertManager({
  code,
  currentMid,
  locale,
  signedIn,
}: {
  code: CurrencyCode;
  currentMid: number | undefined;
  locale: AppLocale;
  signedIn: boolean;
}) {
  const t = useTranslations("alerts");
  const pair = `${code}-IRT`;

  const [alerts, setAlerts] = React.useState<Alert[] | null>(null);
  const [direction, setDirection] = React.useState<"above" | "below">("above");
  const [threshold, setThreshold] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!signedIn) return;
    const { data } = await createClient()
      .from("price_alerts")
      .select("id, pair, direction, threshold, active, last_fired_at")
      .eq("pair", pair)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    setAlerts((data ?? []) as Alert[]);
  }, [pair, signedIn]);

  React.useEffect(() => {
    void load();
  }, [load]);

  // Seed the field with the current price rather than an empty box: an alert is
  // almost always set relative to where things are now, and typing nine digits
  // on a phone to say "a bit above this" is the kind of friction that means
  // nobody sets one.
  React.useEffect(() => {
    if (currentMid && threshold === "") setThreshold(String(Math.round(currentMid)));
  }, [currentMid, threshold]);

  async function add() {
    const value = Number(toLatinDigits(threshold).replace(/[^\d.]/g, ""));
    if (!Number.isFinite(value) || value <= 0) {
      setError(t("errors.threshold"));
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setBusy(false);
      setError(t("errors.signIn"));
      return;
    }
    const { error: dbError } = await supabase
      .from("price_alerts")
      .insert({ user_id: user.id, pair, direction, threshold: value });
    setBusy(false);
    if (dbError) {
      setError(/20 price alerts/.test(dbError.message) ? t("errors.tooMany") : t("errors.failed"));
      return;
    }
    await load();
  }

  async function remove(id: string) {
    setBusy(true);
    // Soft delete, like everything else here: `last_fired_at` on a removed
    // alert is still a record of a message somebody received.
    await createClient()
      .from("price_alerts")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    setBusy(false);
    await load();
  }

  if (!signedIn) {
    return (
      <div className="space-y-3">
        <p className="text-sm leading-relaxed text-ink-600">{t("signInFirst")}</p>
        <Button asChild size="sm">
          <Link href="/signin?next=/rates">{t("signIn")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-ink-600">{t("body")}</p>

      <div className="flex flex-wrap items-end gap-2">
        <fieldset>
          <legend className="text-sm font-medium">{t("when")}</legend>
          <div className="mt-1.5 flex gap-1">
            {(["above", "below"] as const).map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={direction === d}
                onClick={() => setDirection(d)}
                className={
                  direction === d
                    ? "pressable rounded-lg border border-brand-600 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700"
                    : "pressable rounded-lg border border-ink-300 px-3 py-2 text-sm text-ink-600"
                }
              >
                {t(`direction.${d}`)}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="text-sm font-medium">
          {t("threshold")}
          <Input
            dir="ltr"
            inputMode="numeric"
            className="mt-1.5 w-40 font-mono"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
          />
        </label>

        <Button size="sm" disabled={busy} onClick={add}>
          <Bell className="size-4" aria-hidden />
          {t("add")}
        </Button>
      </div>

      {alerts && alerts.length > 0 ? (
        <ul className="space-y-2">
          {alerts.map((alert) => (
            <li
              key={alert.id}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-ink-300/55 p-3"
            >
              <AppTile hue={alert.last_fired_at ? "slate" : "amber"}>
                {alert.last_fired_at ? <BellRing /> : <Bell />}
              </AppTile>
              <span className="flex-1 text-sm">
                {t(`summary.${alert.direction}`, {
                  amount: formatRate(alert.threshold, locale),
                })}
              </span>
              {alert.last_fired_at ? <Badge variant="neutral">{t("fired")}</Badge> : null}
              <Button
                variant="ghost"
                size="sm"
                aria-label={t("remove")}
                disabled={busy}
                onClick={() => remove(alert.id)}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      ) : alerts ? (
        <p className="flex items-center gap-2.5 text-sm text-ink-600">
          <AppTile hue="slate">
            <BellOff />
          </AppTile>
          {t("none")}
        </p>
      ) : null}

      <p className="text-xs leading-relaxed text-ink-600">{t("deliveryNote")}</p>

      {error ? (
        <p className="flex items-start gap-1.5 text-sm text-down">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}
    </div>
  );
}
