/**
 * Unit tests — PATCH + DELETE /api/notifications/[id]
 *
 * Covers:
 *  - PATCH 401 when not authenticated
 *  - PATCH 200 marks notification as read (default)
 *  - PATCH 200 marks notification as unread (explicit is_read: false)
 *  - DELETE 401 when not authenticated
 *  - DELETE 200 removes notification
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeChain } from "@/tests/helpers/supabase-mock";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { PATCH, DELETE } from "@/app/api/notifications/[id]/route";
import { createClient } from "@/lib/supabase/server";

const mockCreateClient = vi.mocked(createClient);

function makeServerClient(user: unknown = { id: "uid-1" }) {
  const chain = makeChain({ data: null, error: null });
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    from: vi.fn().mockReturnValue(chain),
  };
}

function makePatchReq(isRead?: boolean) {
  const body = isRead !== undefined ? JSON.stringify({ is_read: isRead }) : "{}";
  return new NextRequest("http://localhost/api/notifications/nid-1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body,
  });
}

function makeDeleteReq() {
  return new NextRequest("http://localhost/api/notifications/nid-1", { method: "DELETE" });
}

const PARAMS = Promise.resolve({ id: "nid-1" });

beforeEach(() => vi.clearAllMocks());

describe("PATCH /api/notifications/[id]", () => {
  it("returns 401 when not authenticated", async () => {
    mockCreateClient.mockResolvedValue(makeServerClient(null) as never);
    const res = await PATCH(makePatchReq(), { params: PARAMS });
    expect(res.status).toBe(401);
  });

  it("marks as read by default (no body)", async () => {
    mockCreateClient.mockResolvedValue(makeServerClient() as never);
    const res = await PATCH(makePatchReq(), { params: PARAMS });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.is_read).toBe(true);
  });

  it("marks as read when is_read: true", async () => {
    mockCreateClient.mockResolvedValue(makeServerClient() as never);
    const res = await PATCH(makePatchReq(true), { params: PARAMS });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.is_read).toBe(true);
  });

  it("marks as unread when is_read: false", async () => {
    mockCreateClient.mockResolvedValue(makeServerClient() as never);
    const res = await PATCH(makePatchReq(false), { params: PARAMS });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.is_read).toBe(false);
  });
});

describe("DELETE /api/notifications/[id]", () => {
  it("returns 401 when not authenticated", async () => {
    mockCreateClient.mockResolvedValue(makeServerClient(null) as never);
    const res = await DELETE(makeDeleteReq(), { params: PARAMS });
    expect(res.status).toBe(401);
  });

  it("returns 200 on successful delete", async () => {
    mockCreateClient.mockResolvedValue(makeServerClient() as never);
    const res = await DELETE(makeDeleteReq(), { params: PARAMS });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
