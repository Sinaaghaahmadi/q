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
