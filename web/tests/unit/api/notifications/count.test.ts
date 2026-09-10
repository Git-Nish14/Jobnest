/**
 * Unit tests — GET /api/notifications/count
 *
 * Covers:
 *  - 401 when not authenticated
 *  - 429 when rate-limited
 *  - 200 returns { overdueReminders, upcomingInterviews, unreadNotifications, total }
 *  - 200 when all counts are zero
 *  - 200 total includes unread in-app notifications
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: vi.fn() }));

import { GET } from "@/app/api/notifications/count/route";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";

const mockCreateClient = vi.mocked(createClient);
const mockCheckRL      = vi.mocked(checkRateLimit);

// Builds a chain that resolves with { count: N, error: null }
function makeCountChain(count: number) {
  const chain: Record<string, unknown> = {};
  const ret = () => vi.fn().mockReturnValue(chain);
  chain.select = ret();
  chain.eq     = ret();
  chain.lt     = ret();
  chain.lte    = ret();
  chain.gte    = ret();
  chain.then   = (resolve: (v: unknown) => void) =>
    Promise.resolve({ count, error: null }).then(resolve);
  return chain;
}

/**
 * Creates a mock server client that returns the three counts in order:
 * 1st from() call → overdueCount, 2nd → upcomingCount, 3rd → unreadCount.
 * All three are now queried in parallel (Promise.all) in the route handler.
 */
function makeServerClient(
  user: unknown = { id: "uid-1", email: "u@test.com" },
  overdueCount  = 3,
  upcomingCount = 1,
  unreadCount   = 0,
) {
  let idx = 0;
  const counts = [overdueCount, upcomingCount, unreadCount];
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    from: vi.fn(() => makeCountChain(counts[idx++] ?? 0)),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRL.mockResolvedValue({ allowed: true, remaining: 59, resetTime: Date.now() + 60_000 });
});

describe("GET /api/notifications/count — auth", () => {
  it("returns 401 when not authenticated", async () => {
    mockCreateClient.mockResolvedValue(makeServerClient(null) as never);
    const res = await GET();
    expect(res.status).toBe(401);
  });
});

describe("GET /api/notifications/count — rate limit", () => {
  it("returns 429 when rate-limited", async () => {
    mockCreateClient.mockResolvedValue(makeServerClient() as never);
    mockCheckRL.mockResolvedValue({ allowed: false, remaining: 0, resetTime: Date.now() + 30_000 });
    const res = await GET();
    expect(res.status).toBe(429);
  });
});

describe("GET /api/notifications/count — success", () => {
  it("returns counts from all three sources and correct total", async () => {
    mockCreateClient.mockResolvedValue(
      makeServerClient({ id: "uid-1" }, 2, 1, 0) as never,
    );
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.overdueReminders).toBe(2);
    expect(body.upcomingInterviews).toBe(1);
    expect(body.unreadNotifications).toBe(0);
    expect(body.total).toBe(3);
  });

  it("includes unread in-app notifications in total", async () => {
    mockCreateClient.mockResolvedValue(
      makeServerClient({ id: "uid-1" }, 1, 0, 3) as never,
    );
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.unreadNotifications).toBe(3);
    expect(body.total).toBe(4); // 1 overdue + 0 upcoming + 3 unread
  });

  it("returns total of 0 when no overdue, upcoming, or unread", async () => {
    mockCreateClient.mockResolvedValue(
      makeServerClient({ id: "uid-1" }, 0, 0, 0) as never,
    );
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(0);
    expect(body.unreadNotifications).toBe(0);
  });
});
