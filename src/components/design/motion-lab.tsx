"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowDownUp, Play } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CountdownRing } from "@/components/ui/countdown-ring";
import { RollingNumber } from "@/components/ui/rolling-number";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber, toPersianDigits, type AppLocale } from "@/lib/money/format";

/** §13 motion spec, live: logo draw, converter swap spring, digit roll, countdown, shimmer. */
export function MotionLab() {
  const t = useTranslations("design.motion");
  const locale = useLocale() as AppLocale;
  const reduce = useReducedMotion();

  const [logoKey, setLogoKey] = React.useState(0);
  const [swapCount, setSwapCount] = React.useState(0);
  const [value, setValue] = React.useState(189_400);
  const [direction, setDirection] = React.useState<"up" | "down" | null>(null);
  const [remaining, setRemaining] = React.useState(90);

  React.useEffect(() => {
    const id = setInterval(() => setRemaining((r) => (r <= 0 ? 90 : r - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  function tick() {
    const delta = Math.round((Math.random() - 0.45) * 900);
    setDirection(delta >= 0 ? "up" : "down");
    setValue((v) => Math.max(1000, v + delta));
  }

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const clock = locale === "fa" ? toPersianDigits(`${mm}:${ss}`) : `${mm}:${ss}`;
  const swapped = swapCount % 2 === 1;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Card className="flex flex-col items-center gap-4 p-6">
        <p className="text-sm font-medium text-ink-600">{t("logoDraw")}</p>
        <LogoMark key={logoKey} size={64} animated className="text-brand-600" />
        <Button variant="soft" size="sm" onClick={() => setLogoKey((k) => k + 1)}>
          <Play className="size-4" />
          {t("replay")}
        </Button>
      </Card>

      <Card className="flex flex-col items-center gap-4 p-6">
        <p className="text-sm font-medium text-ink-600">{t("swap")}</p>
        <div className="relative flex w-full max-w-52 flex-col gap-2">
          <motion.div
            layout
            transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 24 }}
            className="rounded-xl border border-ink-300/60 bg-canvas px-4 py-3 text-sm font-semibold"
            style={{ order: swapped ? 2 : 1 }}
            dir="ltr"
          >
            USD
          </motion.div>
          <motion.div
            layout
            transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 24 }}
            className="rounded-xl border border-brand-600/40 bg-brand-50/60 px-4 py-3 text-sm font-semibold"
            style={{ order: swapped ? 1 : 2 }}
            dir="ltr"
          >
            IRT
          </motion.div>
          <motion.button
            type="button"
            onClick={() => setSwapCount((c) => c + 1)}
            animate={reduce ? undefined : { rotate: swapCount * 180 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            className="absolute start-1/2 top-1/2 flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-ink-300/60 bg-surface text-brand-600 shadow-e2 rtl:translate-x-1/2"
            aria-label={t("swap")}
          >
            <ArrowDownUp className="size-4" />
          </motion.button>
        </div>
      </Card>

      <Card className="flex flex-col items-center gap-4 p-6">
        <p className="text-sm font-medium text-ink-600">{t("digitRoll")}</p>
        <RollingNumber
          value={formatNumber(value, locale)}
          direction={direction}
          className="text-3xl font-semibold"
        />
        <Button variant="soft" size="sm" onClick={tick}>
          {t("tick")}
        </Button>
      </Card>

      <Card className="flex flex-col items-center gap-4 p-6">
        <p className="text-sm font-medium text-ink-600">{t("countdown")}</p>
        <CountdownRing totalSeconds={90} remainingSeconds={remaining} label={clock} />
        <p className="text-xs text-ink-600">{t("countdownNote")}</p>
      </Card>

      <Card className="flex flex-col gap-3 p-6 sm:col-span-2">
        <p className="text-sm font-medium text-ink-600">{t("skeleton")}</p>
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <Skeleton className="h-8 w-24" />
        </div>
        <p className="text-xs text-ink-600">{t("skeletonNote")}</p>
      </Card>
    </div>
  );
}
