"use client";

import { CircleAlert, UserMinus, UserPlus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import * as React from "react";
import { PanelSection } from "@/components/layout/panel-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDate, type AppLocale } from "@/lib/money/format";
import { createClient } from "@/lib/supabase/client";
import type { AppRole } from "@/lib/supabase/types";

export type SeatRow = {
  id: string;
  userId: string;
  role: OfficeRole;
  since: string;
  /** null when the platform does not let this viewer read that profile. */
  name: string | null;
};

type OfficeRole = "office_viewer" | "office_operator" | "office_finance" | "office_owner";

const ROLES: OfficeRole[] = ["office_viewer", "office_operator", "office_finance", "office_owner"];

const ROLE_TONE = {
  office_viewer: "outline",
  office_operator: "neutral",
  office_finance: "info",
  office_owner: "brand",
} as const;

const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Who may open this office's panel (§4.2).
 *
 * Granting takes a user id and nothing else. That is genuinely awkward, and the
 * copy says so rather than offering an invitation box: nothing in this build
 * delivers an invitation, so a form that asked for a phone number would be a
 * promise the platform does not keep. `admin_set_office_member` admits the
 * office owner alongside platform admins and refuses an unknown id itself, so
 * the checks here only keep obvious typos from becoming a round trip.
 */
export function TeamView({
  officeId,
  members,
  canManage,
  viewerId,
}: {
  officeId: string;
  members: SeatRow[];
  canManage: boolean;
  viewerId: string;
}) {
  const t = useTranslations("officePanel.team");
  const locale = useLocale() as AppLocale;
  const router = useRouter();

  const [userId, setUserId] = React.useState("");
  const [role, setRole] = React.useState<OfficeRole>("office_operator");
  const [confirming, setConfirming] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<string | null>(null);

  async function setSeat(user: string, seatRole: OfficeRole, grant: boolean, key: string) {
    setBusy(key);
    setError(null);
    setNote(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("admin_set_office_member", {
      p_office: officeId,
      p_user: user,
      p_role: seatRole as AppRole,
      p_grant: grant,
    });
    setBusy(null);
    if (rpcError) {
      setError(
        /no such user/i.test(rpcError.message)
          ? t("errors.noSuchUser")
          : /may change the team/i.test(rpcError.message)
            ? t("errors.forbidden")
            : t("errors.failed"),
      );
      return;
    }
    setConfirming(null);
    setNote(grant ? t("granted") : t("revoked"));
    router.refresh();
  }

  function grant() {
    const id = userId.trim().toLowerCase();
    if (!USER_ID.test(id)) {
      setError(t("errors.badId"));
      return;
    }
    setUserId("");
    void setSeat(id, role, true, "new");
  }

  return (
    <div className="space-y-4">
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead className="border-b border-ink-300/40 text-xs text-ink-600">
            <tr>
              <th className="px-4 py-3 text-start font-medium">{t("col.person")}</th>
              <th className="px-4 py-3 text-start font-medium">{t("col.role")}</th>
              <th className="px-4 py-3 text-start font-medium">{t("col.since")}</th>
              <th className="px-4 py-3 text-end font-medium">{t("col.action")}</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-b border-ink-300/25 last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium">
                    {member.name ?? t("unnamed")}
                    {member.userId === viewerId ? (
                      <span className="ms-2 text-xs font-normal text-ink-600">{t("you")}</span>
                    ) : null}
                  </p>
                  <p className="num mt-0.5 font-mono text-xs text-ink-600" dir="ltr">
                    {member.userId.slice(0, 8)}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={ROLE_TONE[member.role]}>{t(`role.${member.role}`)}</Badge>
                </td>
                <td className="num px-4 py-3 text-ink-600">{formatDate(member.since, locale)}</td>
                <td className="px-4 py-3 text-end">
                  {/* Never the viewer's own seat: `admin_set_office_member` has
                      no last-owner guard, so an owner who revoked themselves
                      would lose the one seat that lets them undo it. */}
                  {canManage && member.userId !== viewerId && confirming === member.id ? (
                    <span className="flex flex-wrap items-center justify-end gap-2">
                      <span className="text-xs text-ink-600">{t("revokeConfirm")}</span>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={busy !== null}
                        onClick={() => setSeat(member.userId, member.role, false, member.id)}
                      >
                        {busy === member.id ? t("working") : t("revokeYes")}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setConfirming(null)}>
                        {t("cancel")}
                      </Button>
                    </span>
                  ) : canManage && member.userId !== viewerId ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy !== null}
                      onClick={() => {
                        setConfirming(member.id);
                        setError(null);
                      }}
                    >
                      <UserMinus className="size-4" aria-hidden />
                      {t("revoke")}
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <p className="text-xs text-ink-600">{t("nameNote")}</p>

      {canManage ? (
        <PanelSection title={t("addTitle")} hint={t("addHint")} bodyClassName="space-y-3">
          <p className="text-sm leading-relaxed text-ink-600">{t("addBody")}</p>

          <label className="block text-sm font-medium">
            {t("userIdLabel")}
            <Input
              dir="ltr"
              className="mt-1.5 font-mono"
              placeholder="00000000-0000-0000-0000-000000000000"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            />
          </label>

          <label className="block text-sm font-medium">
            {t("roleLabel")}
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as OfficeRole)}
              className="mt-1.5 h-11 w-full rounded-xl border border-ink-300 bg-surface px-3 text-sm focus:border-brand-600 focus:ring-2 focus:ring-brand-600/25 focus:outline-none"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {t(`role.${r}`)}
                </option>
              ))}
            </select>
          </label>
          <p className="text-sm text-ink-600">{t(`roleMeaning.${role}`)}</p>

          <Button disabled={busy !== null || userId.trim().length === 0} onClick={grant}>
            <UserPlus className="size-4" aria-hidden />
            {busy === "new" ? t("working") : t("grant")}
          </Button>
        </PanelSection>
      ) : (
        <p className="text-sm text-ink-600">{t("readOnly")}</p>
      )}

      {error ? (
        <p className="flex items-start gap-1.5 text-sm text-down">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}
      {note && !error ? <p className="text-sm text-up">{note}</p> : null}
    </div>
  );
}
