"use client";

import { useTranslations } from "next-intl";
import * as React from "react";
import { InstallScene, IosInstallScene } from "@/components/brand/scenes/states";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * "Put this on your home screen", in the two ways phones allow it.
 *
 * The app has been a PWA since the first week — manifest, offline shell — and
 * never asked to be installed, which on a phone is the difference between a
 * bookmark and something people open by habit.
 *
 * Android gets the real thing: Chromium fires `beforeinstallprompt` only when
 * its install criteria are already met, so the card cannot appear on a device
 * that could not install it, and the button hands the decision back to the
 * browser's own dialog.
 *
 * iPhone gets a drawing, because Safari has no such event and no such dialog.
 * The only route is Share → Add to Home Screen, and the only useful thing a
 * website can do is show where to press — so the scene performs the gesture on
 * a loop rather than describing it in a sentence somebody has to translate into
 * a hand movement.
 *
 * A dismissal is remembered per browser, for either kind. It is a suggestion,
 * and a suggestion that comes back is an advertisement.
 */
const DISMISSED_KEY = "asaex.install.dismissed";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function dismissed() {
  try {
    return Boolean(localStorage.getItem(DISMISSED_KEY));
  } catch {
    // Private mode: no memory of a dismissal, so the browser's own rules are
    // the only gate. Acceptable for one card.
    return false;
  }
}

/**
 * An iPhone that is not already running the installed copy.
 *
 * `navigator.standalone` is the iOS-only flag for "launched from the home
 * screen"; the display-mode query catches the same thing everywhere else. iPad
 * has reported itself as a Mac since iPadOS 13, hence the touch check.
 */
function isIosBrowser() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iPad = ua.includes("Macintosh") && navigator.maxTouchPoints > 1;
  if (!/iPhone|iPod/.test(ua) && !iPad) return false;
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return !standalone && !window.matchMedia("(display-mode: standalone)").matches;
}

export function InstallCard() {
  const t = useTranslations("pwa");
  const [event, setEvent] = React.useState<InstallPromptEvent | null>(null);
  const [ios, setIos] = React.useState(false);

  React.useEffect(() => {
    if (dismissed()) return;
    if (isIosBrowser()) {
      setIos(true);
      return;
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
    setIos(false);
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

  if (ios) {
    return (
      <Card className="space-y-4 p-5" data-testid="install-ios">
        <div className="flex items-start gap-4">
          <IosInstallScene size={104} label={t("ios.title")} />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">{t("ios.title")}</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-600">{t("ios.body")}</p>
          </div>
        </div>

        {/* The steps get the card's full width. Beside the drawing they were a
            column narrow enough to break "Add to Home Screen" across two lines,
            which is the one string on the card a reader has to match against
            what their phone says. */}
        <ol className="space-y-2">
          {(["share", "add"] as const).map((step, index) => (
            <li key={step} className="flex items-start gap-2.5 text-sm">
              <span
                className="num mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700 dark:text-brand-600"
                aria-hidden
              >
                {index + 1}
              </span>
              <span className="leading-relaxed">
                {t.rich(`ios.step.${step}`, {
                  // The iOS menu item is Latin inside a Persian sentence:
                  // isolated so the bidi algorithm keeps it in one piece.
                  ios: (chunks) => (
                    <span dir="ltr" className="whitespace-nowrap">
                      {chunks}
                    </span>
                  ),
                })}
              </span>
            </li>
          ))}
        </ol>

        <Button size="sm" variant="secondary" onClick={dismiss}>
          {t("ios.done")}
        </Button>
      </Card>
    );
  }

  if (!event) return null;

  return (
    <Card className="flex flex-wrap items-center gap-4 p-5" data-testid="install-prompt">
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
