import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adminFixture, ORIGIN, RESOURCE, saveRequest, TOKEN, USER_ID } from "./helpers";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: vi.fn() }));

import { POST } from "@/app/api/integrations/chatgpt/applications/check/route";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { hashChatGptKey } from "@/lib/chatgpt/credentials";

const query = { company: "Acme, Inc.", position: "Software Engineer", location: "Chicago, IL (Hybrid)" };
let admin: ReturnType<typeof adminFixture>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_APP_URL", ORIGIN);
  admin = adminFixture();
  vi.mocked(createAdminClient).mockReturnValue(admin as never);
  vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 50, resetTime: Date.now() + 60_000 });
});
afterEach(() => vi.unstubAllEnvs());

describe("ChatGPT duplicate application check", () => {
  it("returns no match without exposing any application data", async () => {
    admin.rpc.mockResolvedValue({ data: { match: false }, error: null });
    const response = await POST(saveRequest(query));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ match: false });
    expect(admin.rpc).toHaveBeenCalledWith("check_chatgpt_application_duplicate", {
      p_key_hash: hashChatGptKey(TOKEN), p_resource: RESOURCE,
      p_company: query.company, p_position: query.position, p_location: query.location,
    });
  });

  it("returns one matching record and a clear duplicate warning", async () => {
    const application = {
      id: "application-1", company: "Acme Inc", position: "Software Engineer",
      location: "Chicago IL Hybrid", status: "Applied", applied_date: "2026-09-01",
      job_url: "https://acme.example.com/jobs/1",
    };
    admin.rpc.mockResolvedValue({ data: { match: true, application }, error: null });
    const response = await POST(saveRequest(query));
    expect(await response.json()).toEqual({
      match: true,
      application,
      url: `${ORIGIN}/applications/application-1`,
      warning: "A Jobnest application already exists for the same company, role, and location. Do not apply again unless this is a different requisition.",
    });
  });

  it.each([
    {}, { ...query, location: " " }, { ...query, company: "" },
    { ...query, user_id: USER_ID }, { ...query, location: "x".repeat(256) },
  ])("rejects incomplete, excessive, or identity-injecting input %j", async (body) => {
    expect((await POST(saveRequest(body))).status).toBe(422);
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("requires the expanded read permission and fails closed on database errors", async () => {
    admin.rpc.mockResolvedValueOnce({ data: { error: "invalid_key" }, error: null });
    expect((await POST(saveRequest(query))).status).toBe(401);
    admin.rpc.mockRejectedValueOnce(new Error("private database detail"));
    const response = await POST(saveRequest(query));
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("private database detail");
  });

  it("rate limits checks by account before querying private applications", async () => {
    vi.mocked(checkRateLimit)
      .mockResolvedValueOnce({ allowed: true, remaining: 1, resetTime: Date.now() })
      .mockResolvedValueOnce({ allowed: false, remaining: 0, resetTime: Date.now() });
    expect((await POST(saveRequest(query))).status).toBe(429);
    expect(admin.rpc).not.toHaveBeenCalled();
  });
});
