import type { AppRole } from "@/lib/supabase/types";

/**
 * UI gating (§5). Convenience only — RLS and the SECURITY DEFINER entry points
 * are what actually decide. Everything here answers "should this button be on
 * the screen", never "may this happen"; getting it wrong shows a button that
 * the database then refuses, which is a design bug, not a security one.
 */

export type Seat = { role: AppRole; scope_type: "platform" | "office"; scope_id: string | null };

/** Every capability the panels gate on, and the roles that hold it. */
const GRANTS = {
  "kyc.review": ["platform_compliance", "platform_admin", "platform_superadmin"],
  "office.provision": ["platform_admin", "platform_superadmin"],
  "office.configure": ["platform_admin", "platform_superadmin"],
  "office.impersonate": ["platform_superadmin"],
  "order.force": ["platform_admin", "platform_superadmin"],
  "order.on_behalf": ["platform_admin", "platform_superadmin"],
  "platform.audit": ["platform_compliance", "platform_admin", "platform_superadmin"],
  "platform.config": ["platform_admin", "platform_superadmin"],
  "platform.oversee": [
    "platform_support",
    "platform_compliance",
    "platform_admin",
    "platform_superadmin",
  ],
  "office.team": ["office_owner", "platform_admin", "platform_superadmin"],
  "office.rates": ["office_owner", "platform_admin", "platform_superadmin"],
  "office.finance": ["office_finance", "office_owner", "platform_admin", "platform_superadmin"],
  "office.operate": [
    "office_operator",
    "office_finance",
    "office_owner",
    "platform_admin",
    "platform_superadmin",
  ],
} as const satisfies Record<string, readonly AppRole[]>;

export type Capability = keyof typeof GRANTS;

/**
 * `scope` narrows an office capability to one office. A platform role satisfies
 * it from any scope; an office role has to hold the seat at that office.
 */
export function can(seats: readonly Seat[], capability: Capability, scope?: string): boolean {
  const allowed: readonly AppRole[] = GRANTS[capability];
  return seats.some((seat) => {
    if (!allowed.includes(seat.role)) return false;
    if (seat.scope_type === "platform") return true;
    return scope === undefined || seat.scope_id === scope;
  });
}

/** The office seats a caller holds, for the "which office am I in" picker. */
export function officeScopes(seats: readonly Seat[]): string[] {
  return [
    ...new Set(
      seats
        .filter((s) => s.scope_type === "office" && s.scope_id !== null)
        .map((s) => s.scope_id as string),
    ),
  ];
}

/** True for any platform seat at all — the gate on `/admin` itself. */
export function isPlatformStaff(seats: readonly Seat[]): boolean {
  return can(seats, "platform.oversee");
}
