"use client";

import { CircleAlert, KeyRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

/** Long enough to be worth having, short enough that nobody writes it down. */
const MIN_LENGTH = 10;

/**
 * The one-time offer to choose your own password.
 *
 * An office arrives on a password an administrator generated and texted them.
 * The brief is explicit that they should be able to set their own on first
 * entry, and equally explicit that they may skip it and keep the generated one.
 *
 * Both routes are one tap and both clear the prompt for good. That matters: an
 * operator cornered into inventing a password at eight in the morning with a
 * queue at the counter picks something worse than the sixteen random characters
 * they were given, and one they will forget by Thursday. The generated password
 * is genuinely fine; this screen is an offer, not a gate.
 *
 * There is also a claim step in front of it, invisible when there is nothing to
 * claim: an office signing in for the first time has an invitation waiting that
 * grants their seat and hands over the password they were texted. Claiming is
 * what turns a phone number into a member of an office.
 */
export function FirstEntry({ pendingInvitationId }: { pendingInvitationId?: string | null }) {
  const t = useTranslations("firstEntry");
  const router = useRouter();

  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [claiming, setClaiming] = React.useState(Boolean(pendingInvitationId));

  // Claim before anything else. Until this runs the account has no office seat,
  // so the panel behind this card would have nothing to show.
  React.useEffect(() => {
    if (!pendingInvitationId) return;
    let cancelled = false;

    void (async () => {
      const supabase = createClient();
      const { data, error: rpcError } = await supabase.rpc("office_invitation_claim", {
        p_invitation: pendingInvitationId,
      });
      if (cancelled) return;

      const claimed = Array.isArray(data) ? data[0] : null;
      // The secret comes back exactly once. Applying it here is what makes the
      // password in the SMS actually work — until now the account had whatever it was
      // created with, which was nothing they were told.
      if (!rpcError && claimed?.secret) {
        await supabase.auth.updateUser({ password: claimed.secret });
      }
      setClaiming(false);
      router.refresh();
    })();

    return () => {
      cancelled = true;
    };
  }, [pendingInvitationId, router]);

  async function choose() {
    if (password.length < MIN_LENGTH) {
      setError(t("errors.tooShort", { min: MIN_LENGTH }));
      return;
    }
    if (password !== confirm) {
      setError(t("errors.mismatch"));
      return;
    }
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.updateUser({ password });
    if (authError) {
      setBusy(false);
      setError(t("errors.failed"));
      return;
    }
    await supabase.rpc("password_choice_settled");
    setBusy(false);
    router.refresh();
  }

  async function skip() {
    setBusy(true);
    await createClient().rpc("password_choice_settled");
    setBusy(false);
    router.refresh();
  }

  if (claiming) {
    return (
      <Card className="mb-5 p-5">
        <p className="text-sm text-ink-600">{t("claiming")}</p>
      </Card>
    );
  }

  return (
    <Card className="mb-5 space-y-4 p-5">
      <div className="flex items-center gap-3">
        <span className="glass flex size-11 shrink-0 items-center justify-center rounded-full">
          <KeyRound className="size-5 text-brand-600" aria-hidden />
        </span>
        <div>
          <h2 className="font-semibold">{t("title")}</h2>
          <p className="text-sm leading-relaxed text-ink-600">{t("body")}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          {t("password")}
          <Input
            type="password"
            autoComplete="new-password"
            className="mt-1.5"
            dir="ltr"
            value={password}
            disabled={busy}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label className="block text-sm font-medium">
          {t("confirm")}
          <Input
            type="password"
            autoComplete="new-password"
            className="mt-1.5"
            dir="ltr"
            value={confirm}
            disabled={busy}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button disabled={busy || password.length < MIN_LENGTH} onClick={choose}>
          {busy ? t("working") : t("cta")}
        </Button>
        <Button variant="ghost" disabled={busy} onClick={skip}>
          {t("skip")}
        </Button>
      </div>
      <p className="text-xs leading-relaxed text-ink-600">{t("skipHint")}</p>

      {error ? (
        <p className="flex items-start gap-1.5 text-sm text-down">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}
    </Card>
  );
}
