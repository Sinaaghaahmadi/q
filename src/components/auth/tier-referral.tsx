"use client";

import { Check, Copy, Gift, TrendingUp } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import * as React from "react";
import { TileHeading } from "@/components/brand/app-tile";
import { useToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatAmount, formatNumber, type AppLocale } from "@/lib/money/format";
import { fromMinor } from "@/lib/money/minor";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/types";

type Tier = {
  tier?: string;
  commission_discount_pct?: number;
  volume_irt?: number;
  next?: { key?: string; from_irt?: number } | null;
  to_next_irt?: number | null;
};

/**
 * §17.8 asks for the tier to be *visible progress*, not a silent perk — so the
 * bar and the "X more to reach Gold" line are the point, and the fee the tier
 * buys is stated next to it rather than left to be discovered on an invoice.
 * §17.9's referral sits beside it because both answer "what do I get for coming
 * back".
 */
export function TierAndReferral({
  tier,
  referralCode,
  invited,
  rewarded,
  alreadyReferred,
}: {
  tier: Json | null;
  referralCode: string | null;
  invited: number;
  rewarded: number;
  alreadyReferred: boolean;
}) {
  const t = useTranslations("profile.rewards");
  const tToast = useTranslations("toast");
  const toast = useToast();
  const locale = useLocale() as AppLocale;
  const router = useRouter();

  const current = (tier ?? {}) as Tier;
  const volume = current.volume_irt ?? 0;
  const nextFrom = current.next?.from_irt ?? null;
  const toNext = current.to_next_irt ?? null;
  const progress =
    nextFrom && nextFrom > 0 ? Math.min(100, Math.round((volume / nextFrom) * 100)) : 100;

  const [code, setCode] = React.useState("");
  const [copied, setCopied] = React.useState(false);
  const [claimState, setClaimState] = React.useState<"idle" | "ok" | "refused">("idle");
  const [busy, setBusy] = React.useState(false);

  async function copy() {
    if (!referralCode) return;
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopied(true);
      toast(tToast("copied"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; say so rather than looking inert.
      toast(tToast("copyFailed"), "bad");
    }
  }

  async function claim() {
    setBusy(true);
    const { data } = await createClient().rpc("referral_claim", { p_code: code.trim() });
    setBusy(false);
    setClaimState(data === true ? "ok" : "refused");
    if (data === true) router.refresh();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="space-y-4 p-5">
        <TileHeading hue="brand" icon={<TrendingUp />} title={t("tierTitle")} />
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <Badge variant="brand">{t(`tier.${current.tier ?? "standard"}`)}</Badge>
            <span className="text-sm text-ink-600">
              {/* toFixed would print 0.5 with a Latin decimal point in
                  Persian, where it reads ۰٫۵ — the one formatter decides both. */}
              {t("feeIs", {
                pct: formatNumber(Number(current.commission_discount_pct ?? 0), locale, {
                  maximumFractionDigits: 2,
                }),
              })}
            </span>
          </div>

          <div>
            <div
              className="h-2 overflow-hidden rounded-full bg-ink-300/40"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t("tierTitle")}
            >
              <div
                className="h-full rounded-full bg-brand-600 transition-[width] duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-ink-600">
              {toNext !== null && current.next?.key
                ? t("toNext", {
                    amount: formatAmount(fromMinor(toNext, "IRT"), "IRT", locale),
                    tier: t(`tier.${current.next.key}`),
                  })
                : t("topTier")}
            </p>
            <p className="num mt-1 text-xs text-ink-600">
              {t("volume", { amount: formatAmount(fromMinor(volume, "IRT"), "IRT", locale) })}
            </p>
          </div>
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <TileHeading
          hue="rose"
          icon={<Gift />}
          title={t("referralTitle")}
          subtitle={t("referralBody")}
        />
        <div className="space-y-3">
          {referralCode ? (
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-xl bg-canvas px-3 py-2.5 font-mono text-sm" dir="ltr">
                {referralCode}
              </code>
              <Button variant="secondary" onClick={copy} aria-label={t("copy")}>
                {copied ? (
                  <Check className="size-4" aria-hidden />
                ) : (
                  <Copy className="size-4" aria-hidden />
                )}
                {copied ? t("copied") : t("copy")}
              </Button>
            </div>
          ) : null}

          <p className="text-sm">{t("invitedCount", { invited, rewarded })}</p>

          {!alreadyReferred ? (
            <div className="space-y-2 border-t border-ink-300/40 pt-3">
              <label htmlFor="referral-code" className="text-sm font-medium">
                {t("haveACode")}
              </label>
              <div className="flex items-center gap-2">
                <Input
                  id="referral-code"
                  dir="ltr"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="flex-1"
                />
                <Button disabled={busy || code.trim().length < 4} onClick={claim}>
                  {t("apply")}
                </Button>
              </div>
              {claimState === "ok" ? <p className="text-sm text-up">{t("claimOk")}</p> : null}
              {claimState === "refused" ? (
                <p className="text-sm text-ink-600">{t("claimRefused")}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
