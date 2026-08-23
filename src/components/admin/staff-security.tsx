"use client";

import { CircleAlert, ShieldCheck, ShieldOff, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

export interface StaffMfaRow {
  user_id: string;
  full_name: string | null;
  roles: string[];
  enrolled: boolean;
}

export interface StaffMfaState {
  required: boolean;
  self_enrolled: boolean;
  staff: StaffMfaRow[];
}

/**
 * Who has a second factor, and the switch that makes it compulsory.
 *
 * Migration 0028 built the enforcement and the launch checklist promised this
 * screen; until now nothing rendered it, so "turn the requirement on once every
 * staff account has enrolled" was an instruction with no way to check the
 * precondition. The roster is that check.
 *
 * The switch is shown even when it cannot be used, and greyed with the reason
 * beside it. A control that vanishes when unavailable leaves an administrator
 * looking for it; one that explains itself answers the question instead.
 *
 * Nothing here is trusted to hold the line — `staff_mfa_require_set` refuses to
 * turn the requirement on while anyone is un-enrolled, and names them when it
 * does. The disabled switch is a courtesy so that refusal is rare, not the
 * defence.
 */
export function StaffSecurity({ state }: { state: StaffMfaState }) {
  const t = useTranslations("admin.security");
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const missing = state.staff.filter((row) => !row.enrolled);
  const covered = state.staff.length - missing.length;
  const canRequire = state.staff.length > 0 && missing.length === 0;

  async function setRequired(on: boolean) {
    setBusy(true);
    setError(null);
    const { error: rpcError } = await createClient().rpc("staff_mfa_require_set", { p_on: on });
    setBusy(false);
    if (rpcError) {
      // The database's message names the accounts that are missing a factor,
      // which is more use than anything this component could compose — but it
      // arrives in English from a Postgres exception, so it is shown as a
      // detail beneath the translated sentence rather than in place of it.
      setError(rpcError.message);
      return;
    }
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-brand-600" aria-hidden />
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-relaxed text-ink-600">{t("body")}</p>

        {!state.self_enrolled ? (
          <p className="flex items-start gap-2 rounded-xl border border-warn/40 bg-warn/8 p-3 text-sm leading-relaxed">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
            <span>
              {t("selfMissing")}{" "}
              <Link href="/profile" className="font-medium underline underline-offset-4">
                {t("selfMissingCta")}
              </Link>
            </span>
          </p>
        ) : null}

        <div className="flex items-start justify-between gap-4 rounded-xl border border-ink-300/55 p-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">{t("require")}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-600">
              {canRequire ? t("requireReady") : t("requireBlocked", { count: missing.length })}
            </p>
          </div>
          <Switch
            checked={state.required}
            // Turning it *off* is never blocked: a safety catch that cannot be
            // released is worse than the lockout it prevents.
            disabled={busy || (!state.required && !canRequire)}
            onCheckedChange={setRequired}
            aria-label={t("require")}
          />
        </div>

        <p className="text-sm text-ink-600">
          {t("coverage", { covered, total: state.staff.length })}
        </p>

        {state.staff.length === 0 ? (
          <p className="text-sm text-ink-600">{t("empty")}</p>
        ) : (
          <ul className="space-y-2">
            {state.staff.map((row) => (
              <li
                key={row.user_id}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-ink-300/55 p-3"
              >
                <span className="min-w-0 flex-1 text-sm font-medium">
                  {row.full_name ?? t("unnamed")}
                </span>
                <span className="flex flex-wrap gap-1">
                  {row.roles.map((role) => (
                    <Badge key={role} variant="outline">
                      {t.has(`role.${role}`) ? t(`role.${role}`) : role}
                    </Badge>
                  ))}
                </span>
                {row.enrolled ? (
                  <Badge variant="up">
                    <ShieldCheck className="size-3.5" aria-hidden />
                    {t("enrolled")}
                  </Badge>
                ) : (
                  <Badge variant="warn">
                    <ShieldOff className="size-3.5" aria-hidden />
                    {t("notEnrolled")}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        )}

        {error ? (
          <p className="flex items-start gap-1.5 text-sm text-down">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              {t("saveFailed")}
              <span className="mt-0.5 block font-mono text-xs break-all opacity-80" dir="ltr">
                {error}
              </span>
            </span>
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
