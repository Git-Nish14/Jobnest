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

function makeRequest(
  origin: string | null,
  url = "http://localhost:3000/api/profile/update-name",
  extraHeaders: Record<string, string> = {}
) {
  const headers: Record<string, string> = { "content-type": "application/json", ...extraHeaders };
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

  it("allows localhost when NEXT_PUBLIC_APP_URL is set to a production URL but NODE_ENV is not production (dev fallback)", () => {
    // The verifyOrigin fix: when NEXT_PUBLIC_APP_URL points to the production URL but
    // the app is running locally (NODE_ENV=test/development), the dev host-based
    // fallback now runs after the primary check fails, allowing local requests.
    // This resolves the 403s that occurred when NEXT_PUBLIC_APP_URL was set to
    // the production URL in a local .env.local file.
    process.env.NEXT_PUBLIC_APP_URL = "https://jobnest.nishpatel.dev";
    // NODE_ENV is "test" in Vitest, so the dev fallback runs
    const req = makeRequest("http://localhost:3000", undefined, { host: "localhost:3000" });
    expect(verifyOrigin(req)).toBe(true);
  });

  it("blocks any origin that doesn't match APP_URL or host (defence against CSRF with mismatched origin)", () => {
    // Even in dev, an attacker-controlled origin that matches neither the static
    // APP_URL nor the Host header is always blocked — the dev fallback only allows
    // requests where the origin matches http(s)://${host}.
    process.env.NEXT_PUBLIC_APP_URL = "https://jobnest.nishpatel.dev";
    const req = makeRequest("https://evil.com", undefined, { host: "localhost:3000" });
    expect(verifyOrigin(req)).toBe(false);
  });

  it("allows production request via x-forwarded-host", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://jobnest.nishpatel.dev";
    const req = makeRequest("https://jobnest.nishpatel.dev", undefined, {
      "x-forwarded-host": "jobnest.nishpatel.dev",
      "x-forwarded-proto": "https",
    });
    expect(verifyOrigin(req)).toBe(true);
  });

  it("blocks cross-origin even when Host header present", () => {
    const req = makeRequest("https://evil.com", undefined, { host: "localhost:3000" });
    expect(verifyOrigin(req)).toBe(false);
  });

  it("blocks arbitrary origins in dev when NEXT_PUBLIC_APP_URL is absent and host does not match", () => {
    // Without a configured URL, only origins matching the actual Host header are allowed.
    // "Fail-open to anything" was removed because it allowed x-forwarded-host spoofing.
    const original = process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    // No host header → origin cannot be corroborated → block
    const req = makeRequest("https://anywhere.com");
    expect(verifyOrigin(req)).toBe(false);
    process.env.NEXT_PUBLIC_APP_URL = original;
  });

  it("allows in dev when NEXT_PUBLIC_APP_URL is absent and host matches origin", () => {
    const original = process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    // host header present and matches → dev fallback allows the request
    const req = makeRequest("http://localhost:3000", undefined, { host: "localhost:3000" });
    expect(verifyOrigin(req)).toBe(true);
    process.env.NEXT_PUBLIC_APP_URL = original;
  });
});
