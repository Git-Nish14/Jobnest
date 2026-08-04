import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/security/csrf", () => ({ verifyOrigin: vi.fn().mockReturnValue(true) }));

import { POST } from "@/app/api/profile/update-connection-goal/route";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyOrigin } from "@/lib/security/csrf";

const mockCreate       = vi.mocked(createClient);
const mockCheckRL      = vi.mocked(checkRateLimit);
const mockVerifyOrigin = vi.mocked(verifyOrigin);

const USER_ID = "user-aaaaaaaa-0000-0000-0000-000000000000";

function makeClient(user: unknown = { id: USER_ID }) {
  return {
    auth: {
      getUser:    vi.fn().mockResolvedValue({ data: { user }, error: null }),
      updateUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
    },
  };
}

function req(body?: unknown) {
  return new Request("http://localhost/api/profile/update-connection-goal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRL.mockReturnValue({ allowed: true, remaining: 9, resetTime: Date.now() + 60_000 });
  mockCreate.mockResolvedValue(makeClient() as never);
  mockVerifyOrigin.mockReturnValue(true);
});

describe("POST /api/profile/update-connection-goal", () => {
  it("returns 200 and echoes the goal on success", async () => {
    const res = await POST(req({ weeklyConnectionGoal: 5 }) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.weeklyConnectionGoal).toBe(5);
  });

  it("saves to user_metadata via updateUser", async () => {
    const client = makeClient();
    mockCreate.mockResolvedValue(client as never);
    await POST(req({ weeklyConnectionGoal: 10 }) as never);
    expect(client.auth.updateUser).toHaveBeenCalledWith({
      data: { weekly_connection_goal: 10 },
    });
  });

  it("returns 403 when CSRF fails", async () => {
    mockVerifyOrigin.mockReturnValue(false);
    const res = await POST(req({ weeklyConnectionGoal: 5 }) as never);
    expect(res.status).toBe(403);
  });

  it("returns 401 when not authenticated", async () => {
    mockCreate.mockResolvedValue(makeClient(null) as never);
    const res = await POST(req({ weeklyConnectionGoal: 5 }) as never);
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRL.mockReturnValue({ allowed: false, remaining: 0, resetTime: Date.now() + 60_000 });
    const res = await POST(req({ weeklyConnectionGoal: 5 }) as never);
    expect(res.status).toBe(429);
  });

  it("returns 422 when goal is below minimum (0)", async () => {
    const res = await POST(req({ weeklyConnectionGoal: 0 }) as never);
    expect(res.status).toBe(422);
  });

  it("returns 422 when goal exceeds maximum (51)", async () => {
    const res = await POST(req({ weeklyConnectionGoal: 51 }) as never);
    expect(res.status).toBe(422);
  });

  it("returns 422 when goal is a non-integer float", async () => {
    const res = await POST(req({ weeklyConnectionGoal: 2.5 }) as never);
    expect(res.status).toBe(422);
  });

  it("accepts boundary value 1", async () => {
    const res = await POST(req({ weeklyConnectionGoal: 1 }) as never);
    expect(res.status).toBe(200);
  });

  it("accepts boundary value 50", async () => {
    const res = await POST(req({ weeklyConnectionGoal: 50 }) as never);
    expect(res.status).toBe(200);
  });
});
