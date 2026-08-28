import { maskPhone, type SmsProvider } from "./types";

/**
 * Test provider. Writes the message to the server log with the number masked
 * and reports success, so the whole notification path can be exercised before
 * gateway credentials exist. It is never selected implicitly in production —
 * `SMS_PROVIDER` has to name it (§17.21: demo data is always labelled).
 */
export const consoleProvider: SmsProvider = {
  id: "console",
  isConfigured() {
    return true;
  },
  async send({ to, body }) {
    console.info(`[sms:console] → ${maskPhone(to)} :: ${body}`);
    return { ok: true, providerMessageId: `console-${Date.now()}`, cost: 0, error: null };
  },
  async sendPattern({ to, pattern, tokens }) {
    console.info(`[sms:console] → ${maskPhone(to)} :: pattern=${pattern} tokens=${tokens.length}`);
    return { ok: true, providerMessageId: `console-${Date.now()}`, cost: 0, error: null };
  },
  async status(providerMessageId) {
    return { providerMessageId, status: "delivered" as const };
  },
};
