/**
 * Unit tests — GET /api/profile/export-data
 *
 * Covers:
 *  - 401 when unauthenticated
 *  - 429 when rate limit exceeded
 *  - 200 with correct JSON structure and Content-Disposition header
 *  - All major data tables are included in the export
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeChain } from "@/tests/helpers/supabase-mock";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: vi.fn() }));

import { GET } from "@/app/api/profile/export-data/route";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/security/rate-limit";

const mockCreateClient = vi.mocked(createClient);
const mockAdminClient = vi.mocked(createAdminClient);
const mockCheckRL = vi.mocked(checkRateLimit);

const TEST_USER = {
  id: "uid-1",
  email: "user@test.com",
  created_at: "2025-01-01T00:00:00Z",
  last_sign_in_at: "2026-01-01T00:00:00Z",
  user_metadata: {
    display_name: "Test User",
    about_me: "A tester",
    notification_prefs: { overdue_reminders: true },
  },
};

function makeServerClient(user: unknown = TEST_USER) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
  };
}

function makeAdmin() {
  // Every table query returns an empty array by default
  return {
    from: vi.fn().mockReturnValue(
      makeChain({ data: [], error: null })
    ),
  };
}

function makeGetRequest() {
  return new Request("http://localhost/api/profile/export-data", { method: "GET" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRL.mockReturnValue({ allowed: true, remaining: 2, resetTime: Date.now() + 86400_000 });
  mockCreateClient.mockResolvedValue(makeServerClient() as never);
  mockAdminClient.mockReturnValue(makeAdmin() as never);
});

describe("GET /api/profile/export-data", () => {
  it("returns 401 when unauthenticated", async () => {
    mockCreateClient.mockResolvedValue(makeServerClient(null) as never);
    const res = await GET(makeGetRequest() as never);
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limit is exceeded", async () => {
    mockCheckRL.mockReturnValue({ allowed: false, remaining: 0, resetTime: Date.now() + 86400_000 });
    const res = await GET(makeGetRequest() as never);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toMatch(/export limit/i);
  });

  it("returns 200 with JSON content-type", async () => {
    const res = await GET(makeGetRequest() as never);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
  });

  it("sets Content-Disposition as attachment with dated filename", async () => {
    const res = await GET(makeGetRequest() as never);
    const cd = res.headers.get("content-disposition") ?? "";
    expect(cd).toMatch(/attachment/);
    expect(cd).toMatch(/jobnest-data-export/);
    expect(cd).toMatch(/\.json/);
  });

  it("export payload contains all required top-level keys", async () => {
    const res = await GET(makeGetRequest() as never);
    const body = await res.json();

    expect(body).toHaveProperty("_meta");
    expect(body).toHaveProperty("profile");
    expect(body).toHaveProperty("job_applications");
    expect(body).toHaveProperty("contacts");
    expect(body).toHaveProperty("interviews");
    expect(body).toHaveProperty("reminders");
    expect(body).toHaveProperty("salary_entries");
    expect(body).toHaveProperty("email_templates");
    expect(body).toHaveProperty("documents");
    expect(body).toHaveProperty("nestai_sessions");
    expect(body).toHaveProperty("account_status");
  });

  it("_meta contains exported_at, user_id, format_version", async () => {
    const res = await GET(makeGetRequest() as never);
    const { _meta } = await res.json();
    expect(_meta.user_id).toBe("uid-1");
    expect(_meta.format_version).toBe("1.0");
    expect(new Date(_meta.exported_at).getTime()).toBeGreaterThan(0);
  });

  it("profile section maps user metadata correctly", async () => {
    const res = await GET(makeGetRequest() as never);
    const { profile } = await res.json();
    expect(profile.id).toBe("uid-1");
    expect(profile.email).toBe("user@test.com");
    expect(profile.display_name).toBe("Test User");
    expect(profile.about_me).toBe("A tester");
  });

  it("rate-limit key is scoped to the user", async () => {
    await GET(makeGetRequest() as never);
    expect(mockCheckRL).toHaveBeenCalledWith(
      "gdpr-export:uid-1",
      expect.objectContaining({ maxRequests: 3 })
    );
  });

  it("data arrays default to empty arrays (not null) when tables are empty", async () => {
    const res = await GET(makeGetRequest() as never);
    const body = await res.json();
    expect(Array.isArray(body.job_applications)).toBe(true);
    expect(Array.isArray(body.contacts)).toBe(true);
    expect(Array.isArray(body.documents)).toBe(true);
  });
});
