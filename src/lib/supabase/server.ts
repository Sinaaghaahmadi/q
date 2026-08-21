import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";

/**
 * Server client bound to the request's cookies. Still the publishable key:
 * the app deliberately holds no service-role key, so nothing server-side can
 * bypass RLS. Privileged operations run through SECURITY DEFINER functions
 * that check the caller's role themselves (`kyc_recommend`, `kyc_decide`,
 * `otp_rate_check`).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component: the middleware refreshes the
            // session instead, so this is safe to ignore.
          }
        },
      },
    },
  );
}

/** The signed-in user's profile, or null. Used to gate server components. */
export async function getSessionProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const { data: memberships } = await supabase
    .from("memberships")
    .select("role, scope_type, scope_id")
    .eq("user_id", user.id)
    .is("deleted_at", null);

  return { user, profile, memberships: memberships ?? [] };
}

/** True when Supabase env vars are present — the app degrades gracefully without them. */
export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
