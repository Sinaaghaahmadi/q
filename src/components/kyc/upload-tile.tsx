"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CircleAlert, RefreshCw, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { EASE_IN } from "@/components/brand/scene";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prepareDocument, sha256Hex, type ImageQuality } from "@/lib/kyc/image";
import { cn } from "@/lib/utils";

export interface PreparedFile {
  blob: Blob;
  preview: string;
  sha256: string;
  quality: ImageQuality;
}

/**
 * One capture slot: pick or shoot a photo, see it normalized and graded on the
 * spot, and get a plain reason when it will not do (§18: every error says what
 * happened and the one thing to do next).
 */
export function UploadTile({
  id,
  label,
  hint,
  capture,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  capture?: "user" | "environment";
  value: PreparedFile | null;
  onChange: (file: PreparedFile | null) => void;
}) {
  const t = useTranslations("kyc.upload");
  const reduce = useReducedMotion();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [failure, setFailure] = React.useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setFailure(null);
    try {
      const prepared = await prepareDocument(file);
      const sha256 = await sha256Hex(prepared.blob);
      onChange({ ...prepared, sha256 });
    } catch {
      setFailure(t("readFailed"));
      onChange(null);
    } finally {
      setBusy(false);
    }
  }

  const verdict = value?.quality.verdict;
  const bad = verdict && verdict !== "ok";

  return (
    <div>
      <p className="text-sm font-medium">{label}</p>
      <div
        className={cn(
          "relative mt-2 aspect-[8/5] w-full overflow-hidden rounded-2xl border-2 border-dashed transition-colors",
          bad ? "border-warn/60 bg-warn/5" : value ? "border-brand-600/50" : "border-ink-300",
        )}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element -- data: URL preview, never a remote asset
          <img src={value.preview} alt="" className="size-full object-cover" />
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="pressable flex size-full flex-col items-center justify-center gap-2 text-ink-600 hover:bg-ink-300/10"
          >
            <Upload className="size-6" />
            <span className="text-sm font-medium">{t("choose")}</span>
            <span className="px-6 text-center text-xs leading-relaxed">{hint}</span>
          </button>
        )}

        {/* scan-line sweep while the image is being graded (§13) */}
        <AnimatePresence>
          {busy && !reduce ? (
            <motion.div
              className="absolute inset-0 bg-ink-900/20"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="absolute inset-x-0 h-1 bg-brand-600"
                initial={{ top: "0%" }}
                animate={{ top: ["0%", "100%", "0%"] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>

        {value && !bad ? (
          <motion.span
            className="absolute end-2 top-2"
            initial={reduce ? false : { opacity: 0, scale: 1.4 }}
            animate={reduce ? undefined : { opacity: 1, scale: 1 }}
            transition={reduce ? undefined : { duration: 0.4, ease: EASE_IN }}
          >
            <Badge variant="up">{t("ok")}</Badge>
          </motion.span>
        ) : null}
      </div>

      <input
        ref={inputRef}
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
        capture={capture}
        className="sr-only"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {bad ? (
        <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-warn">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
          {t(`verdict.${verdict}`)}
        </p>
      ) : null}
      {failure ? <p className="mt-2 text-xs text-down">{failure}</p> : null}

      {value ? (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2"
          onClick={() => {
            onChange(null);
            if (inputRef.current) inputRef.current.value = "";
            inputRef.current?.click();
          }}
        >
          <RefreshCw className="size-4" />
          {t("retake")}
        </Button>
      ) : null}
    </div>
  );
}
