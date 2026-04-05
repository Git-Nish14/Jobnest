/**
 * Unit tests — POST /api/notifications/read-all
 *
 * Covers:
 *  - 401 when not authenticated
 *  - 200 marks all unread notifications as read
 *  - 403 CSRF origin mismatch
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeChain } from "@/tests/helpers/supabase-mock";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { POST } from "@/app/api/notifications/read-all/route";
import { createClient } from "@/lib/supabase/server";

const mockCreateClient = vi.mocked(createClient);

function makeServerClient(user: unknown = { id: "uid-1" }) {
  const chain = makeChain({ data: null, error: null });
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    from: vi.fn().mockReturnValue(chain),
  };
}

function makeReq(origin?: string) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (origin) headers["origin"] = origin;
  return new Request("http://localhost/api/notifications/read-all", { method: "POST", headers });
}

beforeEach(() => vi.clearAllMocks());

describe("POST /api/notifications/read-all", () => {
  it("returns 403 on origin mismatch", async () => {
    mockCreateClient.mockResolvedValue(makeServerClient() as never);
    const res = await POST(makeReq("https://evil.com") as never);
    expect(res.status).toBe(403);
  });

  it("returns 401 when not authenticated", async () => {
    mockCreateClient.mockResolvedValue(makeServerClient(null) as never);
    const res = await POST(makeReq() as never);
    expect(res.status).toBe(401);
  });

  it("returns 200 and marks all as read", async () => {
    mockCreateClient.mockResolvedValue(makeServerClient({ id: "uid-1" }) as never);
    const res = await POST(makeReq() as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
