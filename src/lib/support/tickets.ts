import type { QueueRow } from "@/components/support/ticket-queue";
import { createClient } from "@/lib/supabase/server";
import type { AppLocale } from "@/lib/money/format";

/**
 * Load a ticket queue with the names already resolved.
 *
 * RLS does the scoping: an office member's `select` returns that office's
 * tickets, platform staff get everything. So this takes no scope argument —
 * asking the caller to filter would mean two places that decide who sees what,
 * and one of them would eventually be wrong.
 *
 * Names are joined here rather than in the client component because a queue of
 * a hundred tickets would otherwise be a hundred round trips, and because the
 * office and admin panels want the same three lookups either way.
 */
export async function loadTicketQueue(locale: AppLocale, limit = 200): Promise<QueueRow[]> {
  const supabase = await createClient();

  const [{ data: tickets }, { data: hours }] = await Promise.all([
    supabase
      .from("support_tickets")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase.rpc("ticket_response_hours"),
  ]);
  void hours;

  const rows = tickets ?? [];
  if (rows.length === 0) return [];

  const openerIds = [...new Set(rows.map((row) => row.opened_by))];
  const officeIds = [
    ...new Set(rows.map((row) => row.office_id).filter((id): id is string => !!id)),
  ];

  const [{ data: profiles }, { data: offices }] = await Promise.all([
    supabase.from("profiles").select("id, full_name_fa, full_name_latin").in("id", openerIds),
    officeIds.length > 0
      ? supabase
          .from("exchange_offices")
          .select("id, legal_name_fa, legal_name_en")
          .in("id", officeIds)
      : Promise.resolve({
          data: [] as { id: string; legal_name_fa: string; legal_name_en: string }[],
        }),
  ]);

  const nameOf = new Map<string, string | null>();
  for (const p of profiles ?? []) {
    nameOf.set(
      p.id,
      locale === "fa"
        ? (p.full_name_fa ?? p.full_name_latin)
        : (p.full_name_latin ?? p.full_name_fa),
    );
  }
  const officeOf = new Map<string, string | null>();
  for (const o of offices ?? []) {
    officeOf.set(
      o.id,
      locale === "fa" ? (o.legal_name_fa ?? o.legal_name_en) : (o.legal_name_en ?? o.legal_name_fa),
    );
  }

  return rows.map((row) => ({
    ...row,
    openerName: nameOf.get(row.opened_by) ?? null,
    officeName: row.office_id ? (officeOf.get(row.office_id) ?? null) : null,
  }));
}

/** The window an office has before a ticket may be escalated. */
export async function ticketResponseHours(): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("ticket_response_hours");
  return typeof data === "number" ? data : 24;
}
