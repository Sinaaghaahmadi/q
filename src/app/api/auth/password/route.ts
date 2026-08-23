import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { OFFICE_USERNAME_RE } from "@/lib/auth/office-login";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  /**
   * An email address, or an office's username. Offices sign in with a username
   * because an exchange clerk should not need a mailbox to open the panel.
   */
  email: z.string().trim().min(3).max(320),
  password: z.string().min(8).max(200),
});

/**
 * Password sign-in, for staff only.
 *
 * Customers sign in with a one-time code and always will — a remittance app
 * has no business asking someone to invent a password. Staff are a different
 * problem: a platform administrator or an exchange-office operator has to be
 * able to get in when the SMS gateway is down, from a desk, repeatedly, and an
 * emailed code every time is not a workable login for the person who runs the
 * counter.
 *
 * This is deliberately not a general credential path: only accounts that hold a
 * `memberships` row are allowed through, and a customer who somehow has a
 * password set is signed straight back out. §15 requires TOTP on top of this
 * before production, and `docs/launch-checklist.md` blocks go-live on it.
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
  const identifier = parsed.data.email.trim();

  // A username is resolved to the identifier Supabase actually authenticates.
  // `office_login_identity` checks the password before it answers, so this is
  // not a way to turn a word list into a list of offices' phone numbers — see
  // its docblock. It never issues a session; the grant below still does that,
  // with Supabase's own rate limiting in front of it.
  let credentials:
    { email: string; password: string } | { phone: string; password: string } | null = null;

  if (identifier.includes("@")) {
    credentials = { email: identifier, password: parsed.data.password };
  } else if (OFFICE_USERNAME_RE.test(identifier.toLowerCase())) {
    const { data: rows } = await supabase.rpc("office_login_identity", {
      p_username: identifier,
      p_password: parsed.data.password,
    });
    const found = Array.isArray(rows) ? rows[0] : null;
    if (found?.email) credentials = { email: found.email, password: parsed.data.password };
    else if (found?.phone) credentials = { phone: found.phone, password: parsed.data.password };
  }

  if (!credentials) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const { data, error } = await supabase.auth.signInWithPassword(credentials);

  // One message for a wrong address and a wrong password alike: telling them
  // apart is an account-enumeration oracle.
  if (error || !data.user) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const { data: seats } = await supabase
    .from("memberships")
    .select("role")
    .eq("user_id", data.user.id)
    .is("deleted_at", null)
    .limit(1);

  if (!seats || seats.length === 0) {
    await supabase.auth.signOut();
    return NextResponse.json({ error: "not_staff" }, { status: 403 });
  }

  await supabase.from("login_events").insert({
    user_id: data.user.id,
    kind: "sign_in",
    user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
  });

  return NextResponse.json({ ok: true });
}
