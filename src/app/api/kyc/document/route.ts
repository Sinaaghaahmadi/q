import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const querySchema = z.object({ path: z.string().min(3).max(300) });

/**
 * Mints a 60-second signed URL for one identity document (§6).
 *
 * The request runs on the caller's own session, so storage RLS decides whether
 * they may see it at all — the app holds no service-role key to bypass that.
 * Every successful view is written to `audit_log` (§15: access to every
 * document view is audited).
 */
export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  const parsed = querySchema.safeParse({
    path: request.nextUrl.searchParams.get("path") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { data, error } = await supabase.storage
    .from("kyc-documents")
    .createSignedUrl(parsed.data.path, 60);

  if (error || !data) {
    return NextResponse.json({ error: "not_permitted" }, { status: 403 });
  }

  await supabase.from("audit_log").insert({
    actor_id: user.id,
    action: "kyc.document.view",
    entity_type: "kyc_document",
    reason: parsed.data.path,
  });

  return NextResponse.json({ url: data.signedUrl, expiresIn: 60 });
}
