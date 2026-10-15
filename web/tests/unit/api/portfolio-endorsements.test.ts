import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { makeChain } from "@/tests/helpers/supabase-mock";
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/security/csrf", () => ({ verifyOrigin: vi.fn(() => true) }));
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyOrigin } from "@/lib/security/csrf";
import { GET, POST } from "@/app/api/public/portfolios/[username]/endorsements/route";
import { endorsementIdentity } from "@/lib/security/endorsement-identity";

const skillId = "11111111-1111-4111-8111-111111111111";
const context = { params: Promise.resolve({ username: "test-owner" }) };
let rpc: ReturnType<typeof vi.fn>, profile: ReturnType<typeof vi.fn>, owner: ReturnType<typeof makeChain>;
function request(method = "GET", body: unknown = { skillId }, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/public/portfolios/test-owner/endorsements", {
    method, headers: { origin: "http://localhost", "content-type": "application/json", ...headers },
    ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(verifyOrigin).mockReturnValue(true);
  vi.mocked(checkRateLimit).mockReturnValue({ allowed: true, remaining: 19, resetTime: Date.now() + 60_000 });
  owner = makeChain({ data: { user_id: "owner-id" }, error: null });
  profile = vi.fn().mockResolvedValue({ data: { user: { user_metadata: { portfolio_public: true } } }, error: null });
  rpc = vi.fn().mockResolvedValue({ data: [{ skill_id: skillId, endorsement_count: 1, endorsed: true }], error: null });
  vi.mocked(createAdminClient).mockReturnValue({ from: vi.fn(() => owner), auth: { admin: { getUserById: profile } }, rpc } as never);
});
afterEach(() => vi.unstubAllEnvs());

describe("public endorsements API", () => {
  it("returns only aggregates and an httpOnly visitor cookie without requiring login", async () => {
    const response = await GET(request(), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ skills: [{ skill_id: skillId, endorsement_count: 1, endorsed: true }] });
    expect(response.headers.get("set-cookie")).toMatch(/jobnest_endorser=.*HttpOnly/i);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(rpc).toHaveBeenCalledWith("get_public_skill_endorsements", expect.objectContaining({ p_user_id: "owner-id" }));
  });
  it("takes ownership from the published username and hashes identities", async () => {
    const response = await POST(request("POST"), context);
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("endorse_public_skill", expect.objectContaining({
      p_user_id: "owner-id", p_skill_id: skillId, p_visitor_hash: expect.stringMatching(/^[a-f0-9]{64}$/), p_network_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
    }));
    expect(JSON.stringify(rpc.mock.calls)).not.toContain("127.0.0.1");
  });
  it.each([false, undefined, "true"])("rejects unpublished profiles with publication flag %s", async published => {
    profile.mockResolvedValue({ data: { user: { user_metadata: { portfolio_public: published } } }, error: null });
    expect((await POST(request("POST"), context)).status).toBe(404);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("does not expose unknown profiles", async () => {
    owner = makeChain({ data: null, error: null });
    expect((await GET(request(), context)).status).toBe(404); expect(rpc).not.toHaveBeenCalled();
  });
  it("requires a same-origin write", async () => {
    expect((await POST(request("POST", { skillId }, { origin: "" }), context)).status).toBe(403);
    vi.mocked(verifyOrigin).mockReturnValue(false);
    expect((await POST(request("POST"), context)).status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });
  it.each([{ skillId: "invalid" }, { skillId, user_id: "another" }])("rejects invalid bodies %j", async input => {
    expect((await POST(request("POST", input), context)).status).toBe(422); expect(rpc).not.toHaveBeenCalled();
  });
  it("rate limits before administrative reads", async () => {
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: false, remaining: 0, resetTime: Date.now() });
    expect((await POST(request("POST"), context)).status).toBe(429); expect(profile).not.toHaveBeenCalled();
  });
  it.each([["endorsement_daily_limit", 429], ["endorsement_skill_not_found", 404], ["database detail", 503]])("maps %s safely to %s", async (message, status) => {
    rpc.mockResolvedValue({ data: null, error: { message } });
    const response = await POST(request("POST"), context); expect(response.status).toBe(status);
    expect(await response.text()).not.toContain("database detail");
  });
  it("rejects invalid usernames before database access", async () => {
    expect((await GET(request(), { params: Promise.resolve({ username: "../admin" }) })).status).toBe(404);
    expect(profile).not.toHaveBeenCalled();
  });
});

describe("anonymous endorsement identity", () => {
  it("preserves a signed visitor cookie and replaces tampered values", () => {
    const first = endorsementIdentity(request());
    const same = endorsementIdentity(request("GET", undefined, { cookie: `jobnest_endorser=${first.cookie}` }));
    expect(same.visitorHash).toBe(first.visitorHash); expect(same.networkHash).toBe(first.networkHash);
    const tampered = endorsementIdentity(request("GET", undefined, { cookie: `jobnest_endorser=${first.cookie.slice(0, -1)}x` }));
    expect(tampered.visitorHash).not.toBe(first.visitorHash); expect(tampered.networkHash).toBe(first.networkHash);
  });
  it("fails closed without a trusted production network identity", () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("VERCEL", ""); vi.stubEnv("ENDORSEMENTS_TRUST_PROXY", "");
    expect(() => endorsementIdentity(request("GET", undefined, { "x-real-ip": "1.2.3.4", "x-forwarded-for": "1.2.3.4" }))).toThrow("temporarily unavailable");
  });
  it("trusts the Vercel address and ignores client-supplied forwarding headers", () => {
    vi.stubEnv("VERCEL", "1");
    const first = endorsementIdentity(request("GET", undefined, { "x-vercel-forwarded-for": "203.0.113.7", "x-forwarded-for": "1.2.3.4" }));
    const same = endorsementIdentity(request("GET", undefined, { "x-vercel-forwarded-for": "203.0.113.7", "x-forwarded-for": "5.6.7.8" }));
    expect(same.networkHash).toBe(first.networkHash);
    expect(() => endorsementIdentity(request("GET", undefined, { "x-vercel-forwarded-for": "bad" }))).toThrow();
  });
  it("normalizes IPv6, limits rotation within a /64, and reduces mapped IPv4", () => {
    vi.stubEnv("VERCEL", "1");
    const identity = (ip: string) => endorsementIdentity(request("GET", undefined, { "x-vercel-forwarded-for": ip })).networkHash;
    expect(identity("2001:db8::1")).toBe(identity("2001:0db8:0000:0000::abcd"));
    expect(identity("2001:db8::1")).not.toBe(identity("2001:db8:0:1::1"));
    expect(identity("::ffff:192.0.2.1")).toBe(identity("192.0.2.1"));
  });
});
