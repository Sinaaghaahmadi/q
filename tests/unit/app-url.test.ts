import { afterEach, describe, expect, it } from "vitest";
import { appOrigin } from "@/lib/app-url";

const KEYS = ["NEXT_PUBLIC_APP_URL", "VERCEL_PROJECT_PRODUCTION_URL", "VERCEL_URL"] as const;

afterEach(() => {
  for (const key of KEYS) delete process.env[key];
});

describe("appOrigin", () => {
  it("prefers the configured URL and drops a trailing slash", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://asaex.ir/";
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "asaex.vercel.app";
    expect(appOrigin()).toBe("https://asaex.ir");
  });

  it("falls back to the stable production host on Vercel", () => {
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "asaex.vercel.app";
    process.env.VERCEL_URL = "asaex-abc123.vercel.app";
    expect(appOrigin()).toBe("https://asaex.vercel.app");
  });

  it("describes the deployment itself when there is no production host", () => {
    process.env.VERCEL_URL = "asaex-abc123.vercel.app";
    expect(appOrigin()).toBe("https://asaex-abc123.vercel.app");
  });

  it("is localhost only off-platform", () => {
    expect(appOrigin()).toBe("http://localhost:3000");
  });
});
