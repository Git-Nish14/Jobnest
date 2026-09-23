import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { adminFixture, credential, job, ORIGIN, RESOURCE, savedApplication, saveRequest, TOKEN, USER_ID } from "./helpers";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: vi.fn() }));

import { POST } from "@/app/api/integrations/chatgpt/applications/route";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { hashChatGptKey } from "@/lib/chatgpt/credentials";

let admin: ReturnType<typeof adminFixture>;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_APP_URL", ORIGIN);
  admin = adminFixture();
  vi.mocked(createAdminClient).mockReturnValue(admin as never);
  vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 50, resetTime: Date.now() + 60_000 });
});
afterEach(() => vi.unstubAllEnvs());

describe("ChatGPT save authentication and account boundary", () => {
  it.each(["", "Basic abc", `Bearer ${TOKEN}, Bearer ${TOKEN}`, "Bearer ordinary-supabase-jwt"])("rejects authorization %s before writes", async (authorization) => {
    const response = await POST(saveRequest(job, { authorization, cookie: `access_token=${TOKEN}` }));
    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toBe("Bearer");
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it.each([
    null,
    { ...credential, expires_at: "2000-01-01T00:00:00Z" },
    { ...credential, expires_at: "not-a-date" },
    { ...credential, resource: "https://other.example.com/api/integrations/chatgpt/mcp" },
    { ...credential, scope: "applications:read" },
  ])("denies missing, expired or wrong-audience/scope credentials", async (stored) => {
    admin.credentials.maybeSingle.mockResolvedValue({ data: stored, error: null });
    expect((await POST(saveRequest())).status).toBe(401);
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("never sends a raw token, user-supplied owner or caller Host to the database or saved URL", async () => {
    const response = await POST(saveRequest(job, { host: "attacker.example.com", "x-forwarded-host": "attacker.example.com" }));
    expect(response.status).toBe(201);
    expect(admin.credentials.eq).toHaveBeenCalledWith("key_hash", hashChatGptKey(TOKEN));
    expect(admin.rpc).toHaveBeenCalledWith("save_chatgpt_application", {
      p_key_hash: hashChatGptKey(TOKEN), p_resource: RESOURCE, p_request_id: job.request_id,
      p_content_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      p_application: {
        company: "Acme", position: "Engineer", applied_date: "2026-09-21", status: "Applied",
        job_url: job.job_url,
        location: job.location,
        job_description: job.job_description,
      },
    });
    expect(await response.json()).toEqual({ success: true, application: savedApplication, duplicate: false, url: `${ORIGIN}/applications/application-1` });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(checkRateLimit).toHaveBeenCalledWith(`chatgpt-save:${USER_ID}`, expect.any(Object));
  });

  it("denies a token revoked or account disabled between preflight and transactional save", async () => {
    admin.rpc.mockResolvedValue({ data: { error: "invalid_key" }, error: null });
    const response = await POST(saveRequest());
    expect(response.status).toBe(401);
    expect((await response.json()).success).toBeUndefined();
  });
});

describe("ChatGPT save validation, retries and errors", () => {
  it.each([
    { ...job, user_id: "someone-else" }, { ...job, unexpected: true },
    { ...job, company: " " }, { ...job, company: "x".repeat(256) },
    { ...job, applied_date: "2026-02-30" }, { ...job, applied_date: "September 21" },
    { ...job, job_url: "javascript:alert(1)" }, { ...job, job_url: undefined }, { ...job, status: "Invented" },
    { ...job, location: " " }, { ...job, job_description: " " },
  ])("rejects invalid or owner-injecting arguments", async (body) => {
    expect((await POST(saveRequest(body))).status).toBe(422);
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("uses today's date and Applied status when JOBNEST arguments omit both", async () => {
    const { applied_date: _date, ...withoutDate } = job;
    expect((await POST(saveRequest(withoutDate))).status).toBe(201);
    expect(admin.rpc).toHaveBeenCalledWith("save_chatgpt_application", expect.objectContaining({
      p_application: expect.objectContaining({
        applied_date: new Date().toISOString().slice(0, 10),
        status: "Applied",
        job_description: job.job_description,
      }),
    }));
  });

  it("returns the same payload hash for reordered fields, trimmed values and explicit defaults", async () => {
    await POST(saveRequest(job));
    await POST(saveRequest({
      position: " Engineer ", company: " Acme ", applied_date: job.applied_date, status: "Applied",
      request_id: "second-id", job_url: ` ${job.job_url} `, location: ` ${job.location} `,
      job_description: ` ${job.job_description} `,
    }));
    expect(admin.rpc.mock.calls[0][1].p_content_hash).toBe(admin.rpc.mock.calls[1][1].p_content_hash);
  });

  it("passes every supported application detail to the transactional save", async () => {
    const completeDescription = `Responsibilities, qualifications, skills, benefits, and schedule.\n${"Full posting text. ".repeat(700)}End.`;
    const complete = {
      ...job,
      job_id: "REQ-42",
      job_url: "https://acme.example.com/jobs/42",
      salary_range: "$30-40/hr",
      location: "New York, NY (Hybrid)",
      notes: "Part-time, 20 hours/week. No sponsorship available.",
      job_description: completeDescription,
      source: "Handshake",
      ats_provider: "Workday",
      requires_sponsorship: true,
      company_tier: "Startup",
      glassdoor_rating: 4.2,
    };
    expect((await POST(saveRequest(complete))).status).toBe(201);
    expect(admin.rpc).toHaveBeenCalledWith("save_chatgpt_application", expect.objectContaining({
      p_application: expect.objectContaining({
        job_description: complete.job_description,
        ats_provider: "Workday",
        requires_sponsorship: true,
        company_tier: "Startup",
        glassdoor_rating: 4.2,
      }),
    }));
  });

  it("returns an existing application's link for idempotent retries", async () => {
    admin.rpc.mockResolvedValue({ data: { application: savedApplication, duplicate: true }, error: null });
    const response = await POST(saveRequest());
    expect(response.status).toBe(200);
    expect((await response.json()).duplicate).toBe(true);
  });

  it.each([
    ["request_conflict", 409], ["application_deleted", 409], ["rate_limited", 429], ["invalid_application", 500],
  ])("maps transactional %s to %s without claiming success", async (error, status) => {
    admin.rpc.mockResolvedValue({ data: { error }, error: null });
    const response = await POST(saveRequest());
    expect(response.status).toBe(status);
    expect((await response.json()).success).toBeUndefined();
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("enforces the pre-auth rate limit before querying credentials", async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ allowed: false, remaining: 0, resetTime: Date.now() });
    expect((await POST(saveRequest())).status).toBe(429);
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("enforces the account rate limit before writing", async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ allowed: true, remaining: 1, resetTime: Date.now() });
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ allowed: false, remaining: 0, resetTime: Date.now() });
    expect((await POST(saveRequest())).status).toBe(429);
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("does not expose SDK errors or raw tokens in errors/logs", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    admin.rpc.mockRejectedValue(new Error(`SDK leak ${TOKEN}`));
    const response = await POST(saveRequest());
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain(TOKEN);
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("fails before writing when public configuration is absent", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    expect((await POST(saveRequest())).status).toBe(503);
    expect(admin.rpc).not.toHaveBeenCalled();
  });
});
