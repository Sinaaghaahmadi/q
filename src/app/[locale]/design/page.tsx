import {
  Bell,
  FileText,
  LifeBuoy,
  MessageSquareWarning,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import * as React from "react";
import { AppTile, TileHeading, type TileHue } from "@/components/brand/app-tile";
import { CoinIcon } from "@/components/brand/coin";
import { LogoLockup, LogoMark } from "@/components/brand/logo";
import { NavGroup, NavRow } from "@/components/layout/nav-list";
import { ChartsDemo } from "@/components/design/charts-demo";
import { MotionLab } from "@/components/design/motion-lab";
import { ScenesDemo } from "@/components/design/scenes-demo";
import { ValidationDemo } from "@/components/design/validation-demo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { COLOR_TOKENS, RADIUS_SCALE, SPACING_SCALE, TYPE_SCALE_REM } from "@/lib/brand/tokens";
import { CURRENCY_CODES } from "@/lib/rates/catalog";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "design" });
  return { title: t("metaTitle") };
}

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-label={title} className="scroll-mt-24 space-y-4">
      <div>
        <h2 className="text-xl font-bold">{title}</h2>
        {description ? <p className="mt-1 max-w-2xl text-sm text-ink-600">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** One icon per hue, chosen for the meaning rather than for the shape. */
const TILE_SWATCHES: { hue: TileHue; icon: React.ReactNode }[] = [
  { hue: "brand", icon: <Wallet /> },
  { hue: "indigo", icon: <ShieldCheck /> },
  { hue: "sky", icon: <Users /> },
  { hue: "teal", icon: <LifeBuoy /> },
  { hue: "amber", icon: <Bell /> },
  { hue: "slate", icon: <FileText /> },
  { hue: "rose", icon: <MessageSquareWarning /> },
];

export default async function DesignPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("design");

  const sections = [
    "brand",
    "colors",
    "type",
    "layout",
    "components",
    "validation",
    "coins",
    "tiles",
    "scenes",
    "charts",
    "motion",
  ] as const;

  return (
    <div className="space-y-14 py-4">
      <header className="space-y-3">
        <Badge variant="brand">{t("badge")}</Badge>
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="max-w-2xl leading-relaxed text-ink-600">{t("intro")}</p>
        <nav aria-label={t("tocLabel")} className="flex flex-wrap gap-2 pt-2">
          {sections.map((s) => (
            <a
              key={s}
              href={`#${s}`}
              className="rounded-full border border-ink-300/60 px-3 py-1 text-xs font-medium text-ink-600 transition-colors hover:border-brand-600/50 hover:text-brand-600"
            >
              {t(`sections.${s}`)}
            </a>
          ))}
        </nav>
      </header>

      {/* ── Brand ─────────────────────────────────────────────────────────── */}
      <Section id="brand" title={t("sections.brand")} description={t("brand.description")}>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="flex flex-col items-center justify-center gap-6 p-8">
            <div className="flex items-end gap-6 text-brand-600">
              <LogoMark size={16} />
              <LogoMark size={24} />
              <LogoMark size={40} />
              <LogoMark size={64} />
            </div>
            <p className="text-xs text-ink-600">{t("brand.markSizes")}</p>
          </Card>
          <Card className="flex flex-col items-center justify-center gap-5 p-8">
            <LogoLockup size={32} />
            <p className="text-xs text-ink-600">{t("brand.lockup")}</p>
          </Card>
          <div className="flex flex-col items-center justify-center gap-5 rounded-2xl bg-brand-solid p-8 text-white shadow-e1">
            <LogoMark size={48} />
            {/* Full-strength white: a caption at 80% opacity on the accent drops
                below 4.5:1 in dark mode, and a label is text like any other. */}
            <p className="text-xs text-white">{t("brand.mono")}</p>
          </div>
        </div>
        <ul className="grid gap-2 text-sm text-ink-600 sm:grid-cols-2">
          <li className="rounded-xl bg-surface p-3 shadow-e1">• {t("brand.rules.clearspace")}</li>
          <li className="rounded-xl bg-surface p-3 shadow-e1">• {t("brand.rules.minsize")}</li>
          <li className="rounded-xl bg-surface p-3 shadow-e1">• {t("brand.rules.never")}</li>
          <li className="rounded-xl bg-surface p-3 shadow-e1">• {t("brand.rules.rtl")}</li>
        </ul>
      </Section>

      {/* ── Colors ────────────────────────────────────────────────────────── */}
      <Section id="colors" title={t("sections.colors")} description={t("colors.description")}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {COLOR_TOKENS.map((row) => (
            <Card key={row.token} className="flex items-center gap-3 p-3">
              <span
                className="size-12 shrink-0 rounded-xl border border-ink-300/40"
                style={{ backgroundColor: `var(${row.cssVar})` }}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="block font-mono text-xs font-semibold" dir="ltr">
                  --{row.token}
                </span>
                <span className="block truncate text-xs text-ink-600">
                  {t(`colors.use.${row.useKey}`)}
                </span>
                <span className="block font-mono text-[0.6875rem] text-ink-600/80" dir="ltr">
                  {row.light} · {row.dark}
                </span>
              </span>
            </Card>
          ))}
        </div>
        <p className="text-xs leading-relaxed text-ink-600">{t("colors.note")}</p>
      </Section>

      {/* ── Typography ────────────────────────────────────────────────────── */}
      <Section id="type" title={t("sections.type")} description={t("type.description")}>
        <Card className="divide-y divide-ink-300/40">
          {TYPE_SCALE_REM.map((rem) => (
            <div key={rem} className="flex items-baseline gap-4 px-5 py-3">
              <span className="num w-16 shrink-0 font-mono text-xs text-ink-600" dir="ltr">
                {rem}rem
              </span>
              <span className="truncate" style={{ fontSize: `${rem}rem`, lineHeight: 1.4 }}>
                {t("type.sample")}
              </span>
            </div>
          ))}
        </Card>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="space-y-2 p-5">
            <p className="text-sm font-medium text-ink-600">{t("type.numeralsFa")}</p>
            <p className="rate-hero" dir="rtl">
              ۱۸۹٬۴۰۰ تومان
            </p>
          </Card>
          <Card className="space-y-2 p-5">
            <p className="text-sm font-medium text-ink-600">{t("type.numeralsEn")}</p>
            <p className="rate-hero" dir="ltr">
              189,400 IRT
            </p>
          </Card>
        </div>
      </Section>

      {/* ── Layout: spacing, radius, elevation ────────────────────────────── */}
      <Section id="layout" title={t("sections.layout")} description={t("layout.description")}>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-5">
            <p className="mb-3 text-sm font-medium text-ink-600">{t("layout.spacing")}</p>
            <div className="flex items-end gap-2">
              {SPACING_SCALE.map((s) => (
                <div key={s} className="flex flex-col items-center gap-1">
                  <span className="w-3 rounded-sm bg-brand-600/70" style={{ height: s }} />
                  <span className="num text-[0.625rem] text-ink-600">{s}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-5">
            <p className="mb-3 text-sm font-medium text-ink-600">{t("layout.radius")}</p>
            <div className="flex items-end gap-3">
              {RADIUS_SCALE.map((r) => (
                <div key={r} className="flex flex-col items-center gap-1">
                  <span
                    className="size-12 border-2 border-brand-600/60 bg-brand-50"
                    style={{ borderRadius: r }}
                  />
                  <span className="num text-[0.625rem] text-ink-600">{r}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-5">
            <p className="mb-3 text-sm font-medium text-ink-600">{t("layout.elevation")}</p>
            <div className="flex items-center gap-4">
              <span className="size-14 rounded-xl bg-surface shadow-e1" />
              <span className="size-14 rounded-xl bg-surface shadow-e2" />
              <span className="size-14 rounded-xl bg-surface shadow-e3" />
            </div>
          </Card>
        </div>
      </Section>

      {/* ── Components ────────────────────────────────────────────────────── */}
      <Section
        id="components"
        title={t("sections.components")}
        description={t("components.description")}
      >
        <Card className="space-y-6 p-6">
          <div className="flex flex-wrap items-center gap-3">
            <Button>{t("components.primary")}</Button>
            <Button variant="secondary">{t("components.secondary")}</Button>
            <Button variant="soft">{t("components.soft")}</Button>
            <Button variant="ghost">{t("components.ghost")}</Button>
            <Button variant="destructive">{t("components.destructive")}</Button>
            <Button disabled>{t("components.disabled")}</Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="brand">{t("components.badgeBrand")}</Badge>
            <Badge variant="up">{t("components.badgeUp")}</Badge>
            <Badge variant="down">{t("components.badgeDown")}</Badge>
            <Badge variant="warn">{t("components.badgeWarn")}</Badge>
            <Badge variant="info">{t("components.badgeInfo")}</Badge>
            <Badge variant="neutral">{t("components.badgeNeutral")}</Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input placeholder={t("components.inputPlaceholder")} />
            <Input placeholder={t("components.inputInvalid")} invalid defaultValue="IR12" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-11 w-40" />
            <Skeleton className="size-11 rounded-full" />
            <Skeleton className="h-11 flex-1" />
          </div>
        </Card>
      </Section>

      {/* ── Validators ────────────────────────────────────────────────────── */}
      <Section
        id="validation"
        title={t("sections.validation")}
        description={t("validation.description")}
      >
        <ValidationDemo />
      </Section>

      {/* ── 3D coin set ───────────────────────────────────────────────────── */}
      <Section id="coins" title={t("sections.coins")} description={t("coins.description")}>
        <Card className="p-6">
          <div className="grid grid-cols-4 gap-x-4 gap-y-6 sm:grid-cols-5 md:grid-cols-10">
            {CURRENCY_CODES.map((code) => (
              <div key={code} className="flex flex-col items-center gap-1.5">
                <CoinIcon code={code} size={44} />
                <span className="text-[0.6875rem] font-medium text-ink-600" dir="ltr">
                  {code}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-8 flex items-end justify-center gap-5">
            {[20, 28, 36, 48, 64].map((size) => (
              <CoinIcon key={size} code="USD" size={size} />
            ))}
          </div>
        </Card>
        <p className="text-xs leading-relaxed text-ink-600">{t("coins.rule")}</p>
      </Section>

      {/* ── Icon tiles ────────────────────────────────────────────────────── */}
      <Section id="tiles" title={t("sections.tiles")} description={t("tiles.description")}>
        <Card className="space-y-8 p-6">
          <div>
            <h3 className="text-sm font-semibold">{t("tiles.hueTitle")}</h3>
            <div className="mt-4 grid grid-cols-4 gap-x-4 gap-y-6 sm:grid-cols-7">
              {TILE_SWATCHES.map(({ hue, icon }) => (
                <div key={hue} className="flex flex-col items-center gap-2 text-center">
                  <AppTile hue={hue} size="lg">
                    {icon}
                  </AppTile>
                  <span className="text-[0.6875rem] leading-tight font-medium text-ink-600">
                    {t(`tiles.hue.${hue}`)}
                  </span>
                  {/* Solid ink-600, not a faded one: at 10px this is normal-size
                      text, and ink-600/70 measured 3.59:1 on the light surface —
                      under the 4.5:1 AA floor. The hierarchy against the label
                      above comes from the mono face and the smaller size, which
                      cost nothing in contrast. */}
                  <span className="font-mono text-[0.625rem] text-ink-600" dir="ltr">
                    {hue}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-ink-300/40 pt-6">
            <h3 className="text-sm font-semibold">{t("tiles.sizeTitle")}</h3>
            <p className="mt-1 text-sm text-ink-600">{t("tiles.sizeBody")}</p>
            <div className="mt-4 flex items-end gap-5">
              {(["md", "lg", "xl"] as const).map((size) => (
                <div key={size} className="flex flex-col items-center gap-2">
                  <AppTile hue="brand" size={size}>
                    <Wallet />
                  </AppTile>
                  <span className="font-mono text-[0.625rem] text-ink-600" dir="ltr">
                    {size}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* The three places it appears, side by side, because the tile is not a
            component so much as a habit: a row, a card heading, a page title. */}
        <h3 className="text-sm font-semibold">{t("tiles.usageTitle")}</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <NavGroup title={t("tiles.navTitle")}>
            <NavRow
              href="/accounts"
              label={t("tiles.navAccounts")}
              hint={t("tiles.navAccountsHint")}
              icon={<Wallet />}
              hue="brand"
            />
            <NavRow
              href="/rates?alerts=1"
              label={t("tiles.navAlerts")}
              hint={t("tiles.navAlertsHint")}
              icon={<Bell />}
              hue="amber"
            />
          </NavGroup>
          <Card className="space-y-4 p-5">
            <TileHeading
              hue="indigo"
              icon={<ShieldCheck />}
              title={t("tiles.headingTitle")}
              subtitle={t("tiles.headingBody")}
            />
          </Card>
        </div>
        <p className="text-xs leading-relaxed text-ink-600">{t("tiles.rule")}</p>
      </Section>

      {/* ── Animated illustration ─────────────────────────────────────────── */}
      <Section id="scenes" title={t("sections.scenes")} description={t("scenes.description")}>
        <ScenesDemo />
      </Section>

      {/* ── Charts ────────────────────────────────────────────────────────── */}
      <Section id="charts" title={t("sections.charts")} description={t("charts.description")}>
        <ChartsDemo />
      </Section>

      {/* ── Motion ────────────────────────────────────────────────────────── */}
      <Section id="motion" title={t("sections.motion")} description={t("motion.description")}>
        <MotionLab />
        <p className="text-xs leading-relaxed text-ink-600">{t("motion.rules")}</p>
      </Section>
    </div>
  );
}
