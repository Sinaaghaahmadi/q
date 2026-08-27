"use client";

import { useTranslations } from "next-intl";
import * as React from "react";
import {
  DocumentScene,
  IdentityScene,
  LivenessScene,
  MatchingScene,
  OtpScene,
  ReviewScene,
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
  { key: "matching", Component: MatchingScene },
] as const;

/**
 * The animated illustration set, replayable so the motion can be judged.
 *
 * Seven, not ten. An empty order list, an empty account list and the security
 * card were drawn here and nowhere else once those three screens moved to the
 * app tile — and a reference page that shows art the product does not use
 * teaches the wrong thing about what the product looks like. What is left
 * marks a *moment*: a code arriving, the four steps of proving who you are, a
 * review waiting, a request being matched.
 */
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
