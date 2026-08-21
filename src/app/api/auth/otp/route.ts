import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { normalizeIranianPhone } from "@/lib/sms";

export const dynamic = "force-dynamic";

const bodySchema = z.union([
  z.object({ channel: z.literal("phone"), phone: z.string().min(8).max(20) }),
  z.object({ channel: z.literal("email"), email: z.string().email() }),
]);

/**
 * Starts a sign-in. The rate check runs server-side through the
 * `otp_rate_check` database function (§6, §15) so a client cannot skip it, and
 * only then is Supabase asked to generate and dispatch the code.
 */
export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "auth_unavailable" }, { status: 503 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const supabase = await createClient();
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null;

  if (parsed.data.channel === "phone") {
    const phone = normalizeIranianPhone(parsed.data.phone);
    if (!phone) {
      return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
    }

    const { data: verdict, error: rateError } = await supabase.rpc("otp_rate_check", {
      p_phone: phone,
      p_ip: ip,
    });
    if (rateError) {
      return NextResponse.json({ error: "rate_check_failed" }, { status: 500 });
    }
    const result = verdict as { allowed: boolean; reason?: string; retry_after_minutes?: number };
    if (!result?.allowed) {
      return NextResponse.json(
        { error: "rate_limited", retryAfterMinutes: result?.retry_after_minutes ?? 10 },
        { status: 429 },
      );
    }

    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) {
      // The most common cause is "no SMS provider wired yet" — say that plainly
      // rather than pretending a code was sent (§18).
      const smsUnavailable = /provider|sms|not enabled|unsupported/i.test(error.message);
      return NextResponse.json(
        { error: smsUnavailable ? "sms_channel_unavailable" : "send_failed" },
        { status: smsUnavailable ? 503 : 500 },
      );
    }
    return NextResponse.json({ sent: true, channel: "phone" });
  }

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin}/auth/callback`,
    },
  });
  if (error) {
    return NextResponse.json({ error: "send_failed" }, { status: 500 });
  }
  return NextResponse.json({ sent: true, channel: "email" });
}
