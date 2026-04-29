/**
 * Unit tests — POST /api/salary/export-pdf
 *
 * Covers:
 *   - 403 on cross-origin request
 *   - 401 when not authenticated
 *   - 422 on empty application_ids array (Zod validation)
 *   - 422 on more than 3 application_ids (Zod max)
 *   - 422 on invalid UUID in application_ids
 *   - 429 when rate limited
 *   - 404 when no salary rows belong to the user
 *   - 200 with application/pdf Content-Type on success
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeChain } from "@/tests/helpers/supabase-mock";

vi.mock("@/lib/supabase/server",    () => ({ createClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/security/csrf",       () => ({ verifyOrigin: vi.fn() }));
vi.mock("@react-pdf/renderer", () => ({
  renderToBuffer: vi.fn().mockResolvedValue(Buffer.from("%PDF-1.4 mock")),
  Document: vi.fn(),
  Page: vi.fn(),
  View: vi.fn(),
  Text: vi.fn(),
  StyleSheet: { create: vi.fn(() => ({})) },
}));
vi.mock("@/components/salary/OfferComparisonPDF", () => ({
  OfferComparisonPDF: vi.fn(() => null),
}));

import { POST } from "@/app/api/salary/export-pdf/route";
import { createClient }   from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyOrigin }   from "@/lib/security/csrf";

const mockCreate  = vi.mocked(createClient);
const mockRL      = vi.mocked(checkRateLimit);
const mockOrigin  = vi.mocked(verifyOrigin);

const UID  = "a0a0a0a0-a0a0-4a0a-8a0a-a0a0a0a0a0a0";
const APP1 = "a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1";
const APP2 = "b2b2b2b2-b2b2-4b2b-9b2b-b2b2b2b2b2b2";
const APP3 = "c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3";
const APP4 = "d4d4d4d4-d4d4-4d4d-9d4d-d4d4d4d4d4d4";

function makeRequest(body: unknown, origin?: string): Request {
  return new Request("http://localhost/api/salary/export-pdf", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(origin ? { Origin: origin } : {}),
    },
    body: JSON.stringify(body),
  });
}

function makeClient(user: unknown = { id: UID }, salaryRows: unknown[] = []) {
  const salaryChain = makeChain({ data: salaryRows, error: null });
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    from: vi.fn(() => salaryChain),
  };
}

const SALARY_ROW = {
  id: "e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5",
  application_id: APP1,
  base_salary: 120_000,
  currency: "USD",
  salary_type: "yearly",
  bonus: 10_000,
  equity_details: null,
  signing_bonus: null,
  health_insurance: true,
  dental_insurance: false,
  vision_insurance: false,
  retirement_401k: true,
  retirement_match_percent: 4,
  retirement_match_cap: null,
  pto_days: 20,
  remote_work: "Remote",
  state_of_work: "TX",
  annual_hours_worked: 2080,
  other_benefits: null,
  job_applications: { company: "Acme Corp", position: "SWE", user_id: UID },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockOrigin.mockReturnValue(true);
  mockRL.mockReturnValue({ allowed: true, remaining: 4, resetAt: Date.now() + 86_400_000 });
  mockCreate.mockResolvedValue(makeClient(undefined, [SALARY_ROW]) as never);
});

describe("POST /api/salary/export-pdf — auth & origin", () => {
  it("returns 403 when origin check fails", async () => {
    mockOrigin.mockReturnValue(false);
    const res = await POST(makeRequest({ application_ids: [APP1] }, "http://evil.example.com") as never);
    expect(res.status).toBe(403);
  });

  it("returns 401 when not authenticated", async () => {
    mockCreate.mockResolvedValue(makeClient(null) as never);
    const res = await POST(makeRequest({ application_ids: [APP1] }) as never);
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate-limited", async () => {
    mockRL.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 1000 });
    const res = await POST(makeRequest({ application_ids: [APP1] }) as never);
    expect(res.status).toBe(429);
  });
});

describe("POST /api/salary/export-pdf — input validation (422)", () => {
  it("returns 422 for empty application_ids array", async () => {
    const res = await POST(makeRequest({ application_ids: [] }) as never);
    expect(res.status).toBe(422);
  });

  it("returns 422 for more than 3 IDs", async () => {
    const ids = [APP1, APP2, APP3, APP4];
    const res = await POST(makeRequest({ application_ids: ids }) as never);
    expect(res.status).toBe(422);
  });

  it("returns 422 for non-UUID string in array", async () => {
    const res = await POST(makeRequest({ application_ids: ["not-a-uuid"] }) as never);
    expect(res.status).toBe(422);
  });

  it("returns 422 when application_ids is missing", async () => {
    const res = await POST(makeRequest({}) as never);
    expect(res.status).toBe(422);
  });
});

describe("POST /api/salary/export-pdf — data", () => {
  it("returns 404 when no salary rows belong to the user", async () => {
    const foreignRow = { ...SALARY_ROW, job_applications: { ...SALARY_ROW.job_applications, user_id: "other-user" } };
    mockCreate.mockResolvedValue(makeClient(undefined, [foreignRow]) as never);
    const res = await POST(makeRequest({ application_ids: [APP1] }) as never);
    expect(res.status).toBe(404);
  });

  it("returns 404 when DB returns empty array", async () => {
    mockCreate.mockResolvedValue(makeClient(undefined, []) as never);
    const res = await POST(makeRequest({ application_ids: [APP1] }) as never);
    expect(res.status).toBe(404);
  });

  it("returns 200 with application/pdf content-type on success", async () => {
    const res = await POST(makeRequest({ application_ids: [APP1] }) as never);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toMatch(/attachment/);
  });
});
