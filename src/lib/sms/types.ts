/**
 * SMS gateway abstraction (§3, §12).
 *
 * Iranian gateways require pre-approved *patterns* for one-time codes — free
 * text is rejected for OTP traffic — so the interface separates
 * `sendPattern` (OTP, template id + tokens) from `send` (general text).
 */

export interface SmsMessage {
  to: string;
  body: string;
}

export interface SmsPatternMessage {
  to: string;
  /** Gateway-side approved pattern / template identifier. */
  pattern: string;
  /** Ordered token values the pattern expects. */
  tokens: string[];
}

export interface SmsResult {
  ok: boolean;
  providerMessageId: string | null;
  /** Provider-reported cost, in the gateway's own unit, when available. */
  cost: number | null;
  error: string | null;
}

export interface SmsDeliveryStatus {
  providerMessageId: string;
  status: "queued" | "sent" | "delivered" | "failed" | "unknown";
  raw?: unknown;
}

export interface SmsProvider {
  id: string;
  /** True when the provider holds the credentials it needs to actually send. */
  isConfigured(): boolean;
  send(message: SmsMessage): Promise<SmsResult>;
  sendPattern(message: SmsPatternMessage): Promise<SmsResult>;
  /** Delivery-receipt polling (§12). */
  status(providerMessageId: string): Promise<SmsDeliveryStatus>;
}

/** Normalizes Iranian numbers to E.164 (+98…) and validates the shape. */
export function normalizeIranianPhone(input: string): string | null {
  const digits = input
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\s()-]/g, "");

  let local: string | null = null;
  if (/^09\d{9}$/.test(digits)) local = digits.slice(1);
  else if (/^9\d{9}$/.test(digits)) local = digits;
  else if (/^\+989\d{9}$/.test(digits)) local = digits.slice(3);
  else if (/^00989\d{9}$/.test(digits)) local = digits.slice(4);
  else if (/^989\d{9}$/.test(digits)) local = digits.slice(2);

  return local ? `+98${local}` : null;
}

/** Masks a phone for display and logs — never log the full number (§15). */
export function maskPhone(e164: string): string {
  if (e164.length < 6) return "•".repeat(e164.length);
  return `${e164.slice(0, 5)}••••${e164.slice(-3)}`;
}
