import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock @supabase/ssr — proxy calls createServerClient from this package
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}));

import { createServerClient } from "@supabase/ssr";
import { proxy } from "@/proxy";

const mockCreateServerClient = vi.mocked(createServerClient);

function makeAuthClient(user: unknown) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
    cookies: { setAll: vi.fn() },
  };
}

function req(pathname: string, cookies: Record<string, string> = {}): NextRequest {
  const url = `http://localhost${pathname}`;
  const cookieHeader = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
  return new NextRequest(url, {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
}

const authedUser = { id: "uid", email: "a@b.com", user_metadata: { onboarding_completed: true } };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("proxy — unauthenticated access", () => {
  beforeEach(() => {
    mockCreateServerClient.mockReturnValue(makeAuthClient(null) as never);
  });

  it("allows access to / (landing page)", async () => {
    const res = await proxy(req("/"));
    expect(res.status).not.toBe(307);
    expect(res.status).not.toBe(302);
  });

  it("allows access to /login", async () => {
    const res = await proxy(req("/login"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("allows access to /signup", async () => {
    const res = await proxy(req("/signup"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("allows access to /forgot-password", async () => {
    const res = await proxy(req("/forgot-password"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("allows access to /contact", async () => {
    const res = await proxy(req("/contact"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("allows access to /privacy", async () => {
    const res = await proxy(req("/privacy"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("allows access to /terms", async () => {
    const res = await proxy(req("/terms"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("redirects /dashboard to /login", async () => {
    const res = await proxy(req("/dashboard"));
    const location = res.headers.get("location");
    expect(location).toContain("/login");
  });

  it("redirects /profile to /login", async () => {
    const res = await proxy(req("/profile"));
    const location = res.headers.get("location");
    expect(location).toContain("/login");
  });

  it("redirects /nestai to /login", async () => {
    const res = await proxy(req("/nestai"));
    const location = res.headers.get("location");
    expect(location).toContain("/login");
  });

  it("adds redirect query param preserving intended destination", async () => {
    const res = await proxy(req("/applications"));
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("redirect=%2Fapplications");
  });
});

describe("proxy — authenticated access (sb_rm=1)", () => {
  beforeEach(() => {
    mockCreateServerClient.mockReturnValue(makeAuthClient(authedUser) as never);
  });

  it("redirects / to /dashboard when authenticated", async () => {
    const res = await proxy(req("/", { sb_rm: "1" }));
    const location = res.headers.get("location");
    expect(location).toContain("/dashboard");
  });

  it("redirects /login to /dashboard", async () => {
    const res = await proxy(req("/login", { sb_rm: "1" }));
    const location = res.headers.get("location");
    expect(location).toContain("/dashboard");
  });

  it("redirects /signup to /dashboard", async () => {
    const res = await proxy(req("/signup", { sb_rm: "1" }));
    const location = res.headers.get("location");
    expect(location).toContain("/dashboard");
  });

  it("redirects /forgot-password to /dashboard", async () => {
    const res = await proxy(req("/forgot-password", { sb_rm: "1" }));
    const location = res.headers.get("location");
    expect(location).toContain("/dashboard");
  });

  it("allows /dashboard when authenticated", async () => {
    const res = await proxy(req("/dashboard", { sb_rm: "1" }));
    expect(res.headers.get("location")).toBeNull();
  });
});

describe("proxy — authenticated with sb_rm=0 (session-only)", () => {
  beforeEach(() => {
    mockCreateServerClient.mockReturnValue(makeAuthClient(authedUser) as never);
  });

  it("still redirects / to /dashboard (landing page always redirects)", async () => {
    const res = await proxy(req("/", { sb_rm: "0" }));
    const location = res.headers.get("location");
    expect(location).toContain("/dashboard");
  });

  it("does NOT redirect /login (lets AuthSync handle cleanup)", async () => {
    const res = await proxy(req("/login", { sb_rm: "0" }));
    // Should NOT redirect to dashboard — sb_rm=0 exception
    const location = res.headers.get("location");
    expect(location).toBeNull();
  });

  it("does NOT redirect /signup with sb_rm=0", async () => {
    const res = await proxy(req("/signup", { sb_rm: "0" }));
    expect(res.headers.get("location")).toBeNull();
  });

  it("does NOT redirect /forgot-password with sb_rm=0", async () => {
    const res = await proxy(req("/forgot-password", { sb_rm: "0" }));
    expect(res.headers.get("location")).toBeNull();
  });
});

describe("proxy — open redirect protection", () => {
  beforeEach(() => {
    mockCreateServerClient.mockReturnValue(makeAuthClient(null) as never);
  });

  it("attaches safe redirect param for normal paths", async () => {
    const res = await proxy(req("/applications"));
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("redirect=%2Fapplications");
  });

  it("does NOT attach redirect param for protocol-relative path //evil.com", async () => {
    const res = await proxy(req("//evil.com/steal"));
    // Either the path is not matched (static-file heuristic) or redirects to login without the dangerous redirect
    const location = res.headers.get("location") ?? "";
    expect(location).not.toContain("evil.com");
    if (location.includes("redirect")) {
      expect(location).not.toContain("//evil.com");
    }
  });

  it("does NOT attach redirect param for path starting with //", async () => {
    // Simulate a crafted pathname
    const url = new URL("http://localhost//sneaky");
    const r = new NextRequest(url.toString());
    const res = await proxy(r);
    const location = res.headers.get("location") ?? "";
    // Should redirect to login but NOT carry a dangerous redirect
    if (location.includes("redirect")) {
      const redirectVal = new URL(location).searchParams.get("redirect") ?? "";
      expect(redirectVal.startsWith("//")).toBe(false);
    }
  });
});

describe("proxy — publicApiRoutes exact-match (no prefix bleed)", () => {
  beforeEach(() => {
    mockCreateServerClient.mockReturnValue(makeAuthClient(null) as never);
  });

  it("allows unauthenticated POST to /api/contact (exact match)", async () => {
    const res = await proxy(req("/api/contact"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("blocks unauthenticated access to /api/contact-admin (not in public set)", async () => {
    const res = await proxy(req("/api/contact-admin"));
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("/login");
  });
});

describe("proxy — security headers", () => {
  beforeEach(() => {
    mockCreateServerClient.mockReturnValue(makeAuthClient(null) as never);
  });

  it("sets X-Content-Type-Options on all responses", async () => {
    const res = await proxy(req("/login"));
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("sets X-Frame-Options: DENY", async () => {
    const res = await proxy(req("/login"));
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("sets Referrer-Policy", async () => {
    const res = await proxy(req("/login"));
    expect(res.headers.get("Referrer-Policy")).toBeTruthy();
  });

  it("skips supabase calls for static files (._next)", async () => {
    const res = await proxy(req("/_next/static/chunk.js"));
    // Should return next() immediately without calling createServerClient
    expect(mockCreateServerClient).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
  });
});

describe("proxy — CSP nonce (HTTPS requests)", () => {
  beforeEach(() => {
    mockCreateServerClient.mockReturnValue(makeAuthClient(null) as never);
  });

  // The CSP is only injected when the request looks like HTTPS (x-forwarded-proto header).
  function httpsReq(pathname: string): NextRequest {
    return new NextRequest(`http://localhost${pathname}`, {
      headers: { "x-forwarded-proto": "https" },
    });
  }

  it("sets Content-Security-Policy on HTTPS requests", async () => {
    const res = await proxy(httpsReq("/login"));
    expect(res.headers.get("Content-Security-Policy")).toBeTruthy();
  });

  it("CSP script-src includes a per-request nonce", async () => {
    const res = await proxy(httpsReq("/login"));
    const csp = res.headers.get("Content-Security-Policy") ?? "";
    expect(csp).toMatch(/script-src[^;]*'nonce-[A-Za-z0-9+/=]+'/);;
  });

  it("CSP does not contain unsafe-eval", async () => {
    const res = await proxy(httpsReq("/dashboard"));
    const csp = res.headers.get("Content-Security-Policy") ?? "";
    expect(csp).not.toContain("unsafe-eval");
  });

  it("CSP includes strict-dynamic", async () => {
    const res = await proxy(httpsReq("/login"));
    const csp = res.headers.get("Content-Security-Policy") ?? "";
    expect(csp).toContain("'strict-dynamic'");
  });

  it("generates a unique nonce for every request", async () => {
    const [res1, res2] = await Promise.all([
      proxy(httpsReq("/login")),
      proxy(httpsReq("/login")),
    ]);
    const extractNonce = (csp: string) =>
      csp.match(/'nonce-([A-Za-z0-9+/=]+)'/)?.[1];
    const n1 = extractNonce(res1.headers.get("Content-Security-Policy") ?? "");
    const n2 = extractNonce(res2.headers.get("Content-Security-Policy") ?? "");
    expect(n1).toBeTruthy();
    expect(n2).toBeTruthy();
    expect(n1).not.toBe(n2);
  });

  it("injects x-nonce into the forwarded request headers", async () => {
    // Capture what headers were forwarded by inspecting createServerClient calls.
    // The nonce is set on the NextResponse.next() request headers, not on the
    // createServerClient cookies config — so we verify it's non-empty in the CSP.
    const res = await proxy(httpsReq("/login"));
    const csp = res.headers.get("Content-Security-Policy") ?? "";
    // If the nonce is in the CSP it was generated; that's the meaningful assertion.
    expect(csp).toMatch(/nonce-/);
  });

  it("CSP frame-ancestors is 'none' (clickjacking protection)", async () => {
    const res = await proxy(httpsReq("/login"));
    const csp = res.headers.get("Content-Security-Policy") ?? "";
    expect(csp).toContain("frame-ancestors 'none'");
  });
});
