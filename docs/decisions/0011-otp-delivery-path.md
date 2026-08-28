# 0011 — OTP generation stays in Supabase Auth; delivery routes to Kavenegar

**Decision.** Supabase Auth generates, stores and verifies the one-time code.
Delivery goes through the `send-sms-hook` Edge Function, which the Auth
"Send SMS" hook calls and which forwards to the gateway behind our
`SmsProvider` interface. Our own `/api/auth/otp` route wraps the call so the
`otp_rate_check` limit runs first and cannot be skipped by the client.

**Why.** Kavenegar is not one of Supabase's built-in SMS providers, and
writing our own code store would mean holding, hashing and expiring one-time
secrets ourselves — the exact thing a well-tested auth service already does.
The hook keeps the credential handling in Auth and leaves us only the delivery
leg.

**Testing before the gateway exists.** Sign-in also accepts email, which works
on the built-in mailer with no configuration, so the whole session, KYC and
account flow is exercisable today. The phone path reports
`sms_channel_unavailable` in plain language rather than pretending a code was
sent (§18).

**To switch it on:** set `KAVENEGAR_API_KEY`, `SMS_OTP_PATTERN` and
`SEND_SMS_HOOK_SECRET` on the Edge Function, point Auth → Hooks → Send SMS at
it, and set `SMS_PROVIDER=kavenegar` on the app.
