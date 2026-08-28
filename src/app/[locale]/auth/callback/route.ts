import { NextResponse, type NextRequest } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Magic-link / email-code landing. Exchanges the code for a session, then
 * sends the customer on to whatever they were trying to reach.
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ locale: string }> }) {
  const { locale } = await ctx.params;
  const prefix = locale === "en" ? "/en" : "";
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/verify";

  if (!code || !isSupabaseConfigured()) {
    return NextResponse.redirect(new URL(`${prefix}/signin?error=link_invalid`, url.origin));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return NextResponse.redirect(new URL(`${prefix}/signin?error=link_invalid`, url.origin));
  }

  await supabase.from("login_events").insert({
    user_id: data.user.id,
    kind: "sign_in",
    user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
  });

  return NextResponse.redirect(new URL(`${prefix}${next}`, url.origin));
}
