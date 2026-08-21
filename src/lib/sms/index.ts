import { consoleProvider } from "./console";
import { kavenegarProvider } from "./kavenegar";
import type { SmsProvider } from "./types";

export * from "./types";
export { kavenegarProvider, consoleProvider };

const REGISTRY: Record<string, SmsProvider> = {
  kavenegar: kavenegarProvider,
  console: consoleProvider,
};

/**
 * Resolves the active gateway from `SMS_PROVIDER`, falling back to the console
 * provider when the named gateway has no credentials yet — so a half-configured
 * deployment logs instead of throwing, and the fallback is visible in
 * `/api/health`.
 */
export function getSmsProvider(): SmsProvider {
  const name = process.env.SMS_PROVIDER ?? "console";
  const provider = REGISTRY[name] ?? consoleProvider;
  return provider.isConfigured() ? provider : consoleProvider;
}

/** OTP pattern name registered with the gateway (§12). */
export const OTP_PATTERN = process.env.SMS_OTP_PATTERN ?? "asaex-otp";
