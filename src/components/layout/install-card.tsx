"use client";

import { useTranslations } from "next-intl";
import * as React from "react";
import { InstallScene } from "@/components/brand/scenes/states";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * "Put this on your home screen" — offered once, by the browser's own rules.
 *
 * The app has been a PWA since the first week (manifest, offline shell) and
 * never asked to be installed, which on a phone is the difference between a
 * bookmark and something people open by habit. Chromium fires
 * `beforeinstallprompt` only when the install criteria are already met, so this
 * card cannot appear on a device that could not install it, and iOS Safari —
 * which never fires it — sees nothing rather than instructions it cannot
 * follow.
 *
 * A dismissal is remembered per browser. It is a suggestion, and a suggestion
 * that comes back is an advertisement.
 */
const DISMISSED_KEY = "asaex.install.dismissed";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallCard() {
  const t = useTranslations("pwa");
  const [event, setEvent] = React.useState<InstallPromptEvent | null>(null);

  React.useEffect(() => {
    try {
      if (localStorage.getItem(DISMISSED_KEY)) return;
    } catch {
      // Private mode: no memory of a dismissal, so the browser's own rules
      // are the only gate. That is acceptable for one card.
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    setEvent(null);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // ignore
    }
  }

  async function install() {
    if (!event) return;
    await event.prompt();
    await event.userChoice;
    dismiss();
  }

  if (!event) return null;

  return (
    <Card className="flex flex-wrap items-center gap-4 p-5">
      <InstallScene size={92} />
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-semibold">{t("title")}</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-600">{t("body")}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={install}>
          {t("cta")}
        </Button>
        <Button size="sm" variant="ghost" onClick={dismiss}>
          {t("dismiss")}
        </Button>
      </div>
    </Card>
  );
}
