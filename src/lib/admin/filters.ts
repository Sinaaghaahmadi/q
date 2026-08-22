import type { KycStatus } from "@/lib/supabase/types";

/**
 * Filter vocabularies shared by an admin page and the client table it renders.
 *
 * These have to live outside the `"use client"` file. A Server Component that
 * imports a value from a client module does not get the value — the bundler
 * swaps the module for a client-reference proxy, so the array arrives as
 * something that is not an array, and the page dies at request time with
 * `KYC_STATUSES.find is not a function`. TypeScript sees the declared type and
 * says nothing, so the only way this surfaces is opening the page.
 */

/** The KYC filter's options, and the only `?kyc=` values a page sends to Postgres. */
export const KYC_STATUSES: KycStatus[] = [
  "unverified",
  "pending",
  "approved",
  "rejected",
  "more_info_needed",
];

/** The `settings` rows §4.3 puts on the compliance screen. Nothing else is editable there. */
export const THRESHOLD_KEYS = ["p2p_limits", "customer_tiers"] as const;

/** The `settings` row `/admin/rates` reads and the spread editor writes. */
export const SPREAD_BOUNDS_KEY = "spread_bounds";

/**
 * How much history a customer's page loads. The page uses these as the query
 * `.limit()`, the panel uses them to say "showing the most recent N" — so they
 * have to be one number, not two that drift.
 */
export const ORDERS_SHOWN = 200;
export const LOGINS_SHOWN = 50;
