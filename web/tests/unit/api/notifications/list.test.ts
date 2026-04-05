/**
 * Unit tests — GET + DELETE /api/notifications
 *
 * Covers:
 *  - GET 401 when not authenticated
 *  - GET 200 returns paginated notification list + unread count
 *  - GET 200 with unread filter
 *  - DELETE 403 on CSRF failure (origin mismatch)
 *  - DELETE 401 when not authenticated
 *  - DELETE 200 clears all notifications
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeChain } from "@/tests/helpers/supabase-mock";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: vi.fn() }));

import { GET, DELETE } from "@/app/api/notifications/route";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";

const mockCreateClient = vi.mocked(createClient);
const mockCheckRL      = vi.mocked(checkRateLimit);

const NOTIF = {
  id: "nid-1",
  type: "overdue_reminder",
  title: "Follow up",
  body: "2d overdue",
  link: "/reminders",
  is_read: false,
  created_at: new Date().toISOString(),
  source_type: "reminder",
  source_id: "rid-1",
};

function makeListChain(items: unknown[], count: number) {
  const chain: Record<string, unknown> = {};
  const ret = () => vi.fn().mockReturnValue(chain);
  chain.select  = ret();
  chain.eq      = ret();
  chain.order   = ret();
  chain.limit   = ret();
  chain.lt      = ret();
  chain.delete  = ret();
  chain.single   = vi.fn().mockResolvedValue({ data: null, error: null });
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  chain.then = (resolve: (v: unknown) => void) =>
    Promise.resolve({ data: items, count, error: null }).then(resolve);
  return chain;
}

function makeServerClient(user: unknown = { id: "uid-1" }, items = [NOTIF], unreadCount = 1) {
  let call = 0;
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    from: vi.fn(() => {
      // First call: list query, second: unread count query
      return call++ === 0 ? makeListChain(items, unreadCount) : makeListChain([], unreadCount);
    }),
  };
}

function makeGetReq(filter = "all") {
  return new Request(`http://localhost/api/notifications?filter=${filter}`);
}

function makeDeleteReq(withOrigin = true) {
  const headers: Record<string, string> = {};
  if (withOrigin) headers["origin"] = "http://localhost:3000";
  return new Request("http://localhost/api/notifications", { method: "DELETE", headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRL.mockResolvedValue({ allowed: true, remaining: 29, resetTime: Date.now() + 60_000 });
});

describe("GET /api/notifications", () => {
  it("returns 401 when not authenticated", async () => {
    mockCreateClient.mockResolvedValue(makeServerClient(null) as never);
    const res = await GET(makeGetReq() as never);
    expect(res.status).toBe(401);
  });

  it("returns 200 with notification list and unread count", async () => {
    mockCreateClient.mockResolvedValue(makeServerClient({ id: "uid-1" }, [NOTIF], 1) as never);
    const res = await GET(makeGetReq() as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("notifications");
    expect(body).toHaveProperty("unreadCount");
    expect(body).toHaveProperty("hasMore");
  });

  it("returns empty list when no notifications", async () => {
    mockCreateClient.mockResolvedValue(makeServerClient({ id: "uid-1" }, [], 0) as never);
    const res = await GET(makeGetReq() as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notifications).toHaveLength(0);
    expect(body.unreadCount).toBe(0);
  });

  it("accepts unread filter", async () => {
    mockCreateClient.mockResolvedValue(makeServerClient({ id: "uid-1" }, [NOTIF], 1) as never);
    const res = await GET(makeGetReq("unread") as never);
    expect(res.status).toBe(200);
  });
});

describe("DELETE /api/notifications", () => {
  it("returns 403 when origin header mismatches", async () => {
    mockCreateClient.mockResolvedValue(makeServerClient({ id: "uid-1" }) as never);
    const req = new Request("http://localhost/api/notifications", {
      method: "DELETE",
      headers: { origin: "https://evil.com" },
    });
    const res = await DELETE(req as never);
    expect(res.status).toBe(403);
  });

  it("returns 401 when not authenticated", async () => {
    mockCreateClient.mockResolvedValue(makeServerClient(null) as never);
    const res = await DELETE(makeDeleteReq(false) as never);
    expect(res.status).toBe(401);
  });

  it("returns 200 on successful clear", async () => {
    const deleteChain = makeChain({ data: null, error: null });
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "uid-1" } }, error: null }) },
      from: vi.fn().mockReturnValue(deleteChain),
    };
    mockCreateClient.mockResolvedValue(client as never);
    const res = await DELETE(makeDeleteReq(false) as never);
    expect(res.status).toBe(200);
  });
});
