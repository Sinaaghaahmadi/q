import type {
  SmsDeliveryStatus,
  SmsMessage,
  SmsPatternMessage,
  SmsProvider,
  SmsResult,
} from "./types";

/**
 * Kavenegar (kavenegar.com) — the first concrete Iranian gateway (§12).
 *
 * OTP traffic goes through `verify/lookup` with a pre-approved pattern, which
 * is what the gateway requires for one-time codes; general text uses
 * `sms/send`. Delivery receipts come from `sms/status`.
 *
 * The API key is read at call time so the provider can be constructed before
 * credentials exist — `isConfigured()` reports the truth either way.
 */

const BASE = "https://api.kavenegar.com/v1";
const TIMEOUT_MS = 10_000;

interface KavenegarEntry {
  messageid: number;
  status: number;
  statustext: string;
  cost?: number;
}

interface KavenegarResponse {
  return: { status: number; message: string };
  entries: KavenegarEntry[] | null;
}

/** Kavenegar status codes → our vocabulary. */
function mapStatus(code: number): SmsDeliveryStatus["status"] {
  if (code === 10) return "delivered";
  if (code === 4 || code === 5) return "sent";
  if (code === 1 || code === 2) return "queued";
  if (code === 6 || code === 11 || code === 13 || code === 14) return "failed";
  return "unknown";
}

async function call(path: string, params: Record<string, string>): Promise<KavenegarResponse> {
  const key = process.env.KAVENEGAR_API_KEY;
  if (!key) throw new Error("KAVENEGAR_API_KEY is not set");

  const url = `${BASE}/${key}/${path}.json`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`kavenegar HTTP ${res.status}`);
  return (await res.json()) as KavenegarResponse;
}

function toResult(payload: KavenegarResponse): SmsResult {
  const entry = payload.entries?.[0];
  const ok = payload.return.status === 200 && Boolean(entry);
  return {
    ok,
    providerMessageId: entry ? String(entry.messageid) : null,
    cost: entry?.cost ?? null,
    error: ok ? null : payload.return.message,
  };
}

export const kavenegarProvider: SmsProvider = {
  id: "kavenegar",

  isConfigured() {
    return Boolean(process.env.KAVENEGAR_API_KEY);
  },

  async send({ to, body }: SmsMessage) {
    try {
      const params: Record<string, string> = { receptor: to, message: body };
      const sender = process.env.KAVENEGAR_SENDER;
      if (sender) params.sender = sender;
      return toResult(await call("sms/send", params));
    } catch (err) {
      return {
        ok: false,
        providerMessageId: null,
        cost: null,
        error: err instanceof Error ? err.message : "unknown error",
      };
    }
  },

  async sendPattern({ to, pattern, tokens }: SmsPatternMessage) {
    try {
      const params: Record<string, string> = { receptor: to, template: pattern };
      // Kavenegar's lookup takes token, token2, token3 … in order.
      tokens.slice(0, 10).forEach((value, i) => {
        params[i === 0 ? "token" : `token${i + 1}`] = value;
      });
      return toResult(await call("verify/lookup", params));
    } catch (err) {
      return {
        ok: false,
        providerMessageId: null,
        cost: null,
        error: err instanceof Error ? err.message : "unknown error",
      };
    }
  },

  async status(providerMessageId: string) {
    try {
      const payload = await call("sms/status", { messageid: providerMessageId });
      const entry = payload.entries?.[0];
      return {
        providerMessageId,
        status: entry ? mapStatus(entry.status) : "unknown",
        raw: payload,
      };
    } catch {
      return { providerMessageId, status: "unknown" as const };
    }
  },
};
