/**
 * Supabase Auth "Send SMS" hook → Iranian gateway (§12).
 *
 * Supabase generates and verifies the one-time code itself; this function is
 * only the delivery leg, so the code never lives in our application database.
 * Point Auth → Hooks → "Send SMS" at this function and set
 * `SEND_SMS_HOOK_SECRET`, `KAVENEGAR_API_KEY` and `SMS_OTP_PATTERN`.
 *
 * Until a gateway key exists the function logs the attempt (number masked) and
 * reports success, so the auth flow can be exercised end to end without SMS.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

interface SendSmsPayload {
  user: { id: string; phone: string };
  sms: { otp: string };
}

const KAVENEGAR_BASE = "https://api.kavenegar.com/v1";

function maskPhone(value: string): string {
  return value.length < 6 ? "•".repeat(value.length) : `${value.slice(0, 5)}••••${value.slice(-3)}`;
}

async function sendViaKavenegar(to: string, otp: string): Promise<Response> {
  const key = Deno.env.get("KAVENEGAR_API_KEY");
  const pattern = Deno.env.get("SMS_OTP_PATTERN") ?? "asaex-otp";

  if (!key) {
    console.info(`[send-sms-hook] no gateway key; would send OTP to ${maskPhone(to)}`);
    return new Response(JSON.stringify({ delivered: false, reason: "gateway_not_configured" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  const res = await fetch(`${KAVENEGAR_BASE}/${key}/verify/lookup.json`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ receptor: to, template: pattern, token: otp }).toString(),
  });

  const payload = await res.json().catch(() => null);
  const ok = res.ok && payload?.return?.status === 200;

  if (!ok) {
    console.error(`[send-sms-hook] gateway rejected delivery to ${maskPhone(to)}`);
    return new Response(JSON.stringify({ error: { message: "sms_delivery_failed" } }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ delivered: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }

  const raw = await req.text();
  const secret = Deno.env.get("SEND_SMS_HOOK_SECRET");

  let payload: SendSmsPayload;
  if (secret) {
    try {
      const wh = new Webhook(secret.replace("v1,whsec_", ""));
      payload = wh.verify(raw, Object.fromEntries(req.headers)) as SendSmsPayload;
    } catch {
      return new Response(JSON.stringify({ error: { message: "invalid_signature" } }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }
  } else {
    // No secret configured yet: accept but never trust the caller with more
    // than a delivery attempt, and say so in the log.
    console.warn("[send-sms-hook] SEND_SMS_HOOK_SECRET unset — signature not verified");
    payload = JSON.parse(raw) as SendSmsPayload;
  }

  const phone = payload?.user?.phone;
  const otp = payload?.sms?.otp;
  if (!phone || !otp) {
    return new Response(JSON.stringify({ error: { message: "malformed_payload" } }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  return await sendViaKavenegar(phone, otp);
});
