"use client";

import { CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { createClient } from "@/lib/supabase/client";
import type { FeatureFlag, Json } from "@/lib/supabase/types";

/**
 * Staged rollout (§17.17) and the office template (§16.2) on one screen. The
 * template is read-only here on purpose: editing it would silently move the
 * baseline every existing office is diffed against, which is a migration, not
 * a toggle.
 */
export function FeatureFlags({ flags, defaults }: { flags: FeatureFlag[]; defaults: Json | null }) {
  const t = useTranslations("admin.settings");
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function toggle(flag: FeatureFlag, enabled: boolean) {
    setBusy(flag.id);
    setError(null);
    const supabase = createClient();
    const { error: dbError } = await supabase
      .from("feature_flags")
      .update({ enabled })
      .eq("id", flag.id);
    setBusy(null);
    if (dbError) {
      setError(t("saveFailed"));
      return;
    }
    router.refresh();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{t("flags")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {flags.length === 0 ? (
            <p className="text-sm text-ink-600">{t("noFlags")}</p>
          ) : (
            flags.map((flag) => (
              <div key={flag.id} className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-mono text-sm" dir="ltr">
                    {flag.key}
                  </p>
                  {flag.description ? (
                    <p className="text-sm text-ink-600">{flag.description}</p>
                  ) : null}
                </div>
                <Switch
                  checked={flag.enabled}
                  disabled={busy === flag.id}
                  onCheckedChange={(next) => toggle(flag, next)}
                  aria-label={flag.key}
                />
              </div>
            ))
          )}
          {error ? (
            <p className="flex items-start gap-1.5 text-sm text-down">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {error}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("template")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-ink-600">{t("templateBody")}</p>
          <pre
            dir="ltr"
            className="max-h-80 overflow-auto rounded-xl bg-canvas p-3 font-mono text-[0.6875rem] leading-relaxed"
          >
            {JSON.stringify(defaults ?? {}, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
