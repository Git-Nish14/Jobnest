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

const authedUser = { id: "uid", email: "a@b.com" };

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
