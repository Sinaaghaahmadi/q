"use client";

import { Eye, LogOut } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import * as React from "react";
import { ImpersonationScene } from "@/components/brand/scenes/staff";
import { Button } from "@/components/ui/button";
import { useNow } from "@/lib/hooks/use-now";
import { createClient } from "@/lib/supabase/client";
import type { ExchangeOffice, Impersonation } from "@/lib/supabase/types";

/**
 * "Banner-flagged, time-boxed" (§16.3). The countdown is the point: an
 * administrator standing in for an office should be able to see, without
 * looking for it, that they are not themselves and that it ends on its own.
 * The database enforces the deadline regardless of what this renders.
 */
export function ImpersonationBanner({
  session,
  office,
}: {
  session: Impersonation;
  office: Pick<ExchangeOffice, "legal_name_fa" | "legal_name_en"> | null;
}) {
  const t = useTranslations("admin.impersonation");
  const locale = useLocale();
  const router = useRouter();
  const now = useNow();
  const [ending, setEnding] = React.useState(false);

  const name = office ? (locale === "fa" ? office.legal_name_fa : office.legal_name_en) : null;
  const remainingMs = now ? new Date(session.expires_at).getTime() - now.getTime() : null;

  async function end() {
    setEnding(true);
    const supabase = createClient();
    await supabase.rpc("impersonation_end");
    router.refresh();
    setEnding(false);
  }

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border-2 border-warn/40 bg-warn/10 px-4 py-3"
    >
      <ImpersonationScene size={56} />
      <Eye className="size-5 shrink-0 text-warn sm:hidden" aria-hidden />
      <p className="text-sm font-medium">
        {name ? t("actingAs", { office: name }) : t("actingAsUnknown")}
      </p>
      <p className="text-sm text-ink-600">{t("reason", { reason: session.reason })}</p>
      {remainingMs !== null ? (
        <p className="text-sm text-ink-600 tabular-nums">
          {remainingMs > 0 ? t("endsIn", { time: formatRemaining(remainingMs) }) : t("expired")}
        </p>
      ) : null}
      <Button variant="secondary" className="ms-auto" onClick={end} disabled={ending}>
        <LogOut className="size-4" aria-hidden />
        {t("end")}
      </Button>
    </div>
  );
}

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
