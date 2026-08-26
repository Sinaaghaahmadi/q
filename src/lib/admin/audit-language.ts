/**
 * Turning an audit row's `action` into a sentence.
 *
 * The log stores machine strings — `exchange_offices.update`,
 * `order.force_transition` — because that is the right thing for a log to
 * store: stable, greppable, and never rewritten when the wording changes. The
 * console was printing them as-is, so the busiest screen in the product read
 * `settings.update` and `feature_flags.update` to somebody who has never seen a
 * database table.
 *
 * Two shapes exist. Trigger-written rows are `<table>.<insert|update|delete>`;
 * rows written deliberately by an RPC are `<domain>.<what happened>`. Both split
 * on the dot, so both are handled by translating the halves separately — which
 * also means a table added next year gets a readable sentence from its verb
 * alone rather than falling all the way back to raw text.
 *
 * Nothing is ever hidden. When neither half is known the raw string is shown,
 * because a log that silently drops what it cannot name is worse than an ugly
 * one.
 */

/** Actions worth their own sentence, because the two halves would understate them. */
const NAMED = new Set([
  "office.provision",
  "office.kyc",
  "office.status",
  "order.force_transition",
  "impersonation.start",
  "impersonation.end",
  "p2p.offer_publish",
  "p2p.trade_take",
  "kyc.decision",
]);

export interface AuditPhrase {
  /** `admin.audit.named.<key>` — a whole sentence. */
  named?: string;
  /** `admin.audit.subject.<key>` and `admin.audit.verb.<key>`. */
  subject?: string;
  verb?: string;
  /** Shown when nothing else is known. */
  raw: string;
  /** Whether this is an override worth noticing in a feed. */
  notable: boolean;
}

export function describeAudit(action: string): AuditPhrase {
  const notable =
    action === "order.force_transition" ||
    action.startsWith("impersonation.") ||
    action === "office.status";

  if (NAMED.has(action)) {
    return { named: action.replace(".", "_"), raw: action, notable };
  }

  const dot = action.indexOf(".");
  if (dot <= 0) return { raw: action, notable };

  return {
    subject: action.slice(0, dot),
    verb: action.slice(dot + 1),
    raw: action,
    notable,
  };
}

/**
 * Where an audit row leads.
 *
 * A log entry names a thing that changed, and the thing that changed almost
 * always has a screen. Until now the feed stated what happened and left the
 * reader to go and find it — three navigations and a search box away from a
 * line that already knew the answer. So each row is a link: to the record
 * itself where one has a page, and otherwise to the audit trail filtered to
 * that kind of record, which is the honest fallback rather than a dead row.
 *
 * Keyed on `entity_type`, which is the table name written by the triggers, so
 * a table nobody has mapped here still lands somewhere useful.
 */
const ENTITY_PAGE: Record<string, (id: string) => string> = {
  orders: (id) => `/orders/${id}`,
  exchange_offices: (id) => `/admin/exchanges/${id}`,
  profiles: (id) => `/admin/users/${id}`,
};

/** Sections that own a kind of record but have no page per row. */
const ENTITY_SECTION: Record<string, string> = {
  kyc_submissions: "/admin/kyc",
  support_tickets: "/admin/tickets",
  support_threads: "/admin/support",
  p2p_offers: "/admin/p2p",
  p2p_trades: "/admin/p2p",
  coin_orders: "/admin/orders",
  ledger_entries: "/admin/finance",
  ledger_accounts: "/admin/finance",
  office_settlement_accounts: "/admin/settlement",
  beneficiary_accounts: "/admin/users",
  feature_flags: "/admin/settings",
  platform_settings: "/admin/settings",
  content_blocks: "/admin/content",
  rate_sources: "/admin/rates",
};

export function auditTarget(entityType: string, entityId: string | null): string {
  const page = ENTITY_PAGE[entityType];
  if (page && entityId) return page(entityId);
  return ENTITY_SECTION[entityType] ?? `/admin/audit?entity=${encodeURIComponent(entityType)}`;
}
