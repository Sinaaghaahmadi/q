"use client";

import { useTranslations } from "next-intl";
import * as React from "react";
import {
  AccountsScene,
  DocumentScene,
  IdentityScene,
  LivenessScene,
  MatchingScene,
  OrdersEmptyScene,
  OtpScene,
  ReviewScene,
  SecurityScene,
  SuccessScene,
} from "@/components/brand/scenes";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const SCENES = [
  { key: "otp", Component: OtpScene },
  { key: "identity", Component: IdentityScene },
  { key: "document", Component: DocumentScene },
  { key: "liveness", Component: LivenessScene },
  { key: "review", Component: ReviewScene },
  { key: "success", Component: SuccessScene },
  { key: "accounts", Component: AccountsScene },
  { key: "security", Component: SecurityScene },
  { key: "matching", Component: MatchingScene },
  { key: "ordersEmpty", Component: OrdersEmptyScene },
] as const;

/** The animated illustration set, replayable so the motion can be judged. */
export function ScenesDemo() {
  const t = useTranslations("design.scenes");
  const [generation, setGeneration] = React.useState(0);

  return (
    <div className="space-y-4">
      <Button variant="soft" size="sm" onClick={() => setGeneration((g) => g + 1)}>
        {t("replay")}
      </Button>
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {SCENES.map(({ key, Component }) => (
          <Card key={key} className="flex flex-col items-center gap-2 p-4">
            <Component key={generation} size={112} label={t(`items.${key}`)} />
            <p className="text-center text-xs font-medium text-ink-600">{t(`items.${key}`)}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
