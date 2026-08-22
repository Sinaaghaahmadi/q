"use client";

import { Check, Copy, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * §17.2's shareable link, from the sender's side. The URL is built in the
 * browser so it is right on whatever host this is being read from — the branch
 * deployment, the production alias, or a custom domain later — rather than
 * baked at build time against one of them.
 */
export function ShareStatus({ publicRef }: { publicRef: string }) {
  const t = useTranslations("track.share");
  const [copied, setCopied] = React.useState(false);
  const [url, setUrl] = React.useState("");

  React.useEffect(() => {
    setUrl(`${window.location.origin}/t/${publicRef}`);
  }, [publicRef]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied; the link is selectable on screen.
    }
  }

  return (
    <Card className="space-y-3 p-5">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Share2 className="size-4 text-brand-600" aria-hidden />
          {t("title")}
        </h2>
        <p className="mt-1 text-sm text-ink-600">{t("body")}</p>
      </div>
      <div className="flex items-center gap-2">
        <code
          className="min-w-0 flex-1 truncate rounded-xl bg-canvas px-3 py-2.5 font-mono text-xs"
          dir="ltr"
        >
          {url || `/t/${publicRef}`}
        </code>
        <Button variant="secondary" onClick={copy} disabled={!url}>
          {copied ? (
            <Check className="size-4" aria-hidden />
          ) : (
            <Copy className="size-4" aria-hidden />
          )}
          {copied ? t("copied") : t("copy")}
        </Button>
      </div>
    </Card>
  );
}
