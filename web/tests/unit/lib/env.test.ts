import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", "production");
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("startup environment validation", () => {
  it("starts without SES_FROM_EMAIL when the email transport has a default sender", async () => {
    vi.stubEnv("SES_FROM_EMAIL", undefined);
    const { validateEnv } = await import("@/lib/env");
    const { getSenderEmail } = await import("@/lib/email/ses");

    expect(getSenderEmail()).toBe("me@nishpatel.dev");
    expect(() => validateEnv()).not.toThrow();
  });

  it("still rejects an explicitly invalid sender", async () => {
    vi.stubEnv("SES_FROM_EMAIL", "invalid-address");
    const { validateEnv } = await import("@/lib/env");

    expect(() => validateEnv()).toThrow("Invalid sender email address");
  });

  it("still requires the core security configuration", async () => {
    vi.stubEnv("CSRF_SECRET", undefined);
    const { validateEnv } = await import("@/lib/env");

    expect(() => validateEnv()).toThrow("CSRF_SECRET");
  });
});
