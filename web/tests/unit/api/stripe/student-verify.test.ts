/**
 * Unit tests — GET /api/stripe/student-verify
 *
 * Covers:
 *  - 401 when not authenticated
 *  - 401 when user has no email
 *  - 429 when rate-limited
 *  - 200 eligible=true for .edu email
 *  - 200 eligible=false for .com email
 *  - 200 eligible=true for .ac.uk email
 *  - 200 eligible=true for .edu.au email
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: vi.fn() }));

import { GET } from "@/app/api/stripe/student-verify/route";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";

const mockCreateClient = vi.mocked(createClient);
const mockCheckRL      = vi.mocked(checkRateLimit);

// Pass null (not undefined — undefined triggers the default param value in JS)
function makeClient(email: string | null = "student@university.edu") {
  const user = email !== null ? { id: "uid-1", email } : { id: "uid-1" };
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRL.mockResolvedValue({ allowed: true, remaining: 9, resetTime: Date.now() + 60_000 });
});

describe("GET /api/stripe/student-verify — auth", () => {
  it("returns 401 when not authenticated", async () => {
    mockCreateClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) } } as never);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 401 when user has no email", async () => {
    mockCreateClient.mockResolvedValue(makeClient(null) as never);
    const res = await GET();
    expect(res.status).toBe(401);
  });
});

describe("GET /api/stripe/student-verify — rate limit", () => {
  it("returns 429 when rate-limited", async () => {
    mockCreateClient.mockResolvedValue(makeClient() as never);
    mockCheckRL.mockResolvedValue({ allowed: false, remaining: 0, resetTime: Date.now() + 60_000 });
    const res = await GET();
    expect(res.status).toBe(429);
  });
});

describe("GET /api/stripe/student-verify — eligibility", () => {
  it("returns eligible=true for .edu email", async () => {
    mockCreateClient.mockResolvedValue(makeClient("alice@mit.edu") as never);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.eligible).toBe(true);
    expect(body.domain).toBe("mit.edu");
  });

  it("returns eligible=false for .com email", async () => {
    mockCreateClient.mockResolvedValue(makeClient("user@gmail.com") as never);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.eligible).toBe(false);
  });

  it("returns eligible=true for .ac.uk email", async () => {
    mockCreateClient.mockResolvedValue(makeClient("bob@oxford.ac.uk") as never);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.eligible).toBe(true);
  });

  it("returns eligible=true for .edu.au email", async () => {
    mockCreateClient.mockResolvedValue(makeClient("carol@anu.edu.au") as never);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.eligible).toBe(true);
  });
});
