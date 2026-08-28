import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { OFFICE_USERNAME_RE } from "@/lib/auth/office-login";
import { getSmsProvider, normalizeIranianPhone } from "@/lib/sms";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const schema = z.object({
  officeId: z.string().uuid(),
  username: z.string().trim().toLowerCase(),
  /** Where the credentials are texted. This is the "شماره مقصد" of the brief. */
  phone: z.string().trim().min(6).max(20),
  /** Typed by the administrator, or generated here when absent. */
  password: z.string().min(10).max(72).optional(),
  /** False when the administrator will pass the credentials on themselves. */
  sendSms: z.boolean().default(true),
});

/**
 * Provision an office a login and text it over.
 *
 * The account itself is not created here and cannot be: this application holds
 * no service-role key (ADR 0010), so there is no way to mint a user from the
 * outside. What is created is an *invitation* — username, password, destination
 * phone — which the office takes up by signing in with that phone the ordinary
 * way. `supabase/migrations/0026` has the reasoning in full.
 *
 * The password is generated here rather than in Postgres because its alphabet
 * is a decision about people, not about data: it will be read down a phone line
 * far more often than it is copied, so the characters that get misheard are
 * left out.
 */
export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  const { officeId, username, sendSms } = parsed.data;

  if (!OFFICE_USERNAME_RE.test(username)) {
    return NextResponse.json({ error: "invalid_username" }, { status: 400 });
  }
  const phone = normalizeIranianPhone(parsed.data.phone);
  if (!phone) {
    return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const password = parsed.data.password ?? generatePassword();

  // Authorisation lives in the function, not here: `office_invitation_create`
  // refuses anyone who is not a platform administrator, so a route that forgot
  // to check would still be refused by the database.
  const { data: invitationId, error } = await supabase.rpc("office_invitation_create", {
    p_payload: { office_id: officeId, username, phone, secret: password },
  });

  if (error) {
    const message = error.message ?? "";
    if (message.includes("username:")) {
      return NextResponse.json({ error: "username_taken" }, { status: 409 });
    }
    if (message.includes("only a platform administrator")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "invite_failed" }, { status: 400 });
  }

  // A failed message is reported, never fatal. The invitation is already real
  // and the administrator can read the password off their own screen.
  let sms: "sent" | "failed" | "skipped" = "skipped";
  if (sendSms) {
    const { data: office } = await supabase
      .from("exchange_offices")
      .select("display_name, legal_name_fa")
      .eq("id", officeId)
      .maybeSingle();
    const officeName = office?.display_name ?? office?.legal_name_fa ?? "";
    const origin = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;

    const result = await getSmsProvider().send({
      to: phone,
      body: [
        `صرافی آسا — پنل ${officeName}`,
        `نام کاربری: ${username}`,
        `رمز عبور: ${password}`,
        `ورود: ${origin}/signin`,
        "بار اول با همین شمارهٔ موبایل وارد شوید.",
      ].join("\n"),
    });
    sms = result.ok ? "sent" : "failed";
  }

  return NextResponse.json({
    invitationId,
    username,
    // Shown once, on screen. Supabase will only ever hold its hash, and the
    // invitation row drops it the moment it is claimed, so this response is the
    // last chance anyone has to read it.
    password,
    phone,
    sms,
  });
}

/**
 * A password worth generating.
 *
 * Sixteen characters from a 55-symbol alphabet is about 92 bits, which is far
 * past anything that matters here. The alphabet leaves out the characters that
 * get misheard or mistyped — no 0/O, no 1/l/I, no 5/S — which costs about two
 * bits and saves a phone call.
 */
function generatePassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint32Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
