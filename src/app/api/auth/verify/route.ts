import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { normalizeIranianPhone } from "@/lib/sms";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  phone: z.string().min(8).max(20),
  token: z.string().regex(/^\d{4,8}$/),
});

/** Exchanges a phone one-time code for a session and records the sign-in. */
export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "auth_unavailable" }, { status: 503 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const phone = normalizeIranianPhone(parsed.data.phone);
  if (!phone) {
    return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    phone,
    token: parsed.data.token,
    type: "sms",
  });

  if (error || !data.user) {
    return NextResponse.json({ error: "invalid_code" }, { status: 401 });
  }

  await supabase.from("login_events").insert({
    user_id: data.user.id,
    kind: "sign_in",
    user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
  });

  return NextResponse.json({ ok: true });
}
