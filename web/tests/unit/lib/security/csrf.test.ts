/**
 * Unit tests — lib/security/csrf.ts → verifyOrigin
 *
 * Covers:
 *  - Requests with no Origin header → allowed (same-origin browser request)
 *  - Requests matching NEXT_PUBLIC_APP_URL → allowed
 *  - Requests from a different origin → blocked
 *  - Edge cases: malformed origins, missing env var
 */
import { describe, it, expect, afterEach } from "vitest";
import { verifyOrigin } from "@/lib/security/csrf";

const APP_URL = "http://localhost:3000"; // set in vitest-setup.ts

function makeRequest(origin: string | null, url = "http://localhost:3000/api/profile/update-name") {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (origin !== null) headers["origin"] = origin;
  return new Request(url, { method: "POST", headers, body: "{}" });
}

afterEach(() => {
  // Restore NEXT_PUBLIC_APP_URL after tests that mutate it
  process.env.NEXT_PUBLIC_APP_URL = APP_URL;
});

describe("verifyOrigin", () => {
  it("allows requests with no Origin header (same-origin / server-to-server)", () => {
    const req = makeRequest(null);
    expect(verifyOrigin(req)).toBe(true);
  });

  it("allows requests whose Origin matches NEXT_PUBLIC_APP_URL", () => {
    const req = makeRequest("http://localhost:3000");
    expect(verifyOrigin(req)).toBe(true);
  });

  it("blocks requests from a different origin", () => {
    const req = makeRequest("https://evil.example.com");
    expect(verifyOrigin(req)).toBe(false);
  });

  it("blocks requests from a subdomain of the app", () => {
    const req = makeRequest("https://sub.jobnest.nishpatel.dev");
    expect(verifyOrigin(req)).toBe(false);
  });

  it("blocks protocol-relative mismatch (http vs https)", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://jobnest.nishpatel.dev";
    const req = makeRequest("http://jobnest.nishpatel.dev");
    expect(verifyOrigin(req)).toBe(false);
  });

  it("allows matching production origin", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://jobnest.nishpatel.dev";
    const req = makeRequest("https://jobnest.nishpatel.dev");
    expect(verifyOrigin(req)).toBe(true);
  });

  it("fails open in non-production when NEXT_PUBLIC_APP_URL is absent", () => {
    const original = process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    const originalNodeEnv = process.env.NODE_ENV;
    // In test environment (non-production) should allow
    const req = makeRequest("https://anywhere.com");
    const result = verifyOrigin(req);
    expect(result).toBe(true);
    process.env.NEXT_PUBLIC_APP_URL = original;
    process.env.NODE_ENV = originalNodeEnv;
  });
});
