"use client";

import { BadgeCheck, CircleAlert, ImageUp, ShieldAlert, ShieldQuestion } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import * as React from "react";
import { OfficeLogo, officeLogoUrl } from "@/components/office/office-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import type { ExchangeOffice, Json } from "@/lib/supabase/types";

/** Half a megabyte, matching the bucket's own limit. */
const MAX_BYTES = 512 * 1024;
const ACCEPT = "image/png,image/jpeg,image/webp,image/svg+xml";

/**
 * Who this office is, as it sees itself.
 *
 * The brief asks for the owner to be able to see their logo alongside their own
 * details and change the logo if they want to. The details are read-only except
 * the two that are theirs to decide — what they are called and what they look
 * like. The registered owner, the national code and the licence belong to the
 * verification the platform performed; an office that could edit those after
 * approval would make the approval worth nothing, and `admin_update_office`
 * refuses those fields for an office seat rather than trusting this screen.
 *
 * The upload goes straight to storage from the browser, on the office's own
 * session, so the bucket policy is what decides — this app holds no
 * service-role key and nothing here can bypass it. The object path starts with
 * the office id because that is what the policy matches a membership against.
 */
export function OfficeIdentityCard({
  office,
  canEdit,
}: {
  office: ExchangeOffice;
  /** True for the office owner and for platform administrators. */
  canEdit: boolean;
}) {
  const t = useTranslations("officeIdentity");
  const router = useRouter();

  const [name, setName] = React.useState(office.display_name ?? office.legal_name_fa);
  const [logoPath, setLogoPath] = React.useState(office.logo_path);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const nameChanged = name.trim() !== (office.display_name ?? office.legal_name_fa);

  async function saveName() {
    setBusy(true);
    setError(null);
    const { error: rpcError } = await createClient().rpc("admin_update_office", {
      p_office: office.id,
      p_patch: { display_name: name.trim(), reason: "renamed by the office" } as unknown as Json,
    });
    setBusy(false);
    if (rpcError) {
      setError(t("errors.saveFailed"));
      return;
    }
    setNote(t("saved"));
    router.refresh();
  }

  async function upload(file: File) {
    setError(null);
    if (file.size > MAX_BYTES) {
      setError(t("errors.tooBig"));
      return;
    }
    setBusy(true);

    const supabase = createClient();
    // The extension is taken from the MIME type rather than the filename: a
    // file called `logo.png` that is really a JPEG would be served with the
    // wrong content type, and the bucket only accepts four types anyway.
    const ext = EXTENSIONS[file.type] ?? "png";
    // A fresh name per upload, so a replaced logo is never served from a cache
    // that still holds the old one.
    const path = `${office.id}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("office-logos")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) {
      setBusy(false);
      setError(t("errors.uploadFailed"));
      return;
    }

    const { error: rpcError } = await supabase.rpc("admin_update_office", {
      p_office: office.id,
      p_patch: { logo_path: path, reason: "logo changed" } as unknown as Json,
    });
    setBusy(false);
    if (rpcError) {
      setError(t("errors.saveFailed"));
      return;
    }

    // The old object is left in place deliberately. Storage is cheap, a stale
    // logo hurts nobody, and a delete that raced a page still rendering the old
    // path would show a broken image to a customer.
    setLogoPath(path);
    setNote(t("logoSaved"));
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-center gap-4">
          <OfficeLogo
            name={name}
            logoUrl={officeLogoUrl(logoPath)}
            officeId={office.id}
            size={72}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold">{name}</p>
            <p className="truncate text-sm text-ink-600">{office.legal_name_en}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <VerificationBadge state={office.kyc_state} />
              <Badge variant="neutral">{t(`status.${office.status}`)}</Badge>
            </div>
          </div>

          {canEdit ? (
            <div>
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPT}
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void upload(file);
                  e.target.value = "";
                }}
              />
              <Button variant="secondary" disabled={busy} onClick={() => fileRef.current?.click()}>
                <ImageUp className="size-4" aria-hidden />
                {logoPath ? t("changeLogo") : t("addLogo")}
              </Button>
              <p className="mt-1 text-xs text-ink-600">{t("logoHint")}</p>
            </div>
          ) : null}
        </div>

        {office.kyc_state === "rejected" && office.kyc_reason ? (
          <p className="rounded-xl bg-down/10 p-3 text-sm leading-relaxed text-down">
            {office.kyc_reason}
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            {t("displayName")}
            <Input
              className="mt-1.5"
              value={name}
              disabled={!canEdit || busy}
              onChange={(e) => setName(e.target.value)}
            />
            <span className="mt-1 block text-xs text-ink-600">{t("displayNameHint")}</span>
          </label>

          <ReadOnly label={t("ownerName")} value={office.owner_name} />
          <ReadOnly label={t("nationalId")} value={office.national_id} mono />
          <ReadOnly label={t("licence")} value={office.license_no} mono />
        </div>

        <p className="text-xs leading-relaxed text-ink-600">{t("lockedNote")}</p>

        {canEdit ? (
          <Button disabled={!nameChanged || busy} onClick={saveName}>
            {busy ? t("working") : t("save")}
          </Button>
        ) : null}

        {error ? (
          <p className="flex items-start gap-1.5 text-sm text-down">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error}
          </p>
        ) : null}
        {note && !error ? <p className="text-sm text-up">{note}</p> : null}
      </CardContent>
    </Card>
  );
}

function VerificationBadge({ state }: { state: ExchangeOffice["kyc_state"] }) {
  const t = useTranslations("officeIdentity");
  if (state === "verified") {
    return (
      <Badge variant="up">
        <BadgeCheck className="size-3.5" aria-hidden />
        {t("kyc.verified")}
      </Badge>
    );
  }
  if (state === "rejected") {
    return (
      <Badge variant="down">
        <ShieldAlert className="size-3.5" aria-hidden />
        {t("kyc.rejected")}
      </Badge>
    );
  }
  if (state === "pending") {
    return (
      <Badge variant="warn">
        <ShieldQuestion className="size-3.5" aria-hidden />
        {t("kyc.pending")}
      </Badge>
    );
  }
  return (
    <Badge variant="neutral">
      <ShieldQuestion className="size-3.5" aria-hidden />
      {t("kyc.unverified")}
    </Badge>
  );
}

function ReadOnly({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
}) {
  const t = useTranslations("officeIdentity");
  return (
    <div>
      <p className="text-sm font-medium">{label}</p>
      <p
        className={mono ? "mt-1.5 font-mono text-sm text-ink-600" : "mt-1.5 text-sm text-ink-600"}
        dir={mono ? "ltr" : undefined}
      >
        {value ?? t("notSet")}
      </p>
    </div>
  );
}

const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};
