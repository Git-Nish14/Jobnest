import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeChain } from "@/tests/helpers/supabase-mock";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/security/csrf", () => ({ verifyOrigin: vi.fn().mockReturnValue(true) }));

import { PATCH } from "@/app/api/networking/contacts/[id]/outreach/route";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyOrigin } from "@/lib/security/csrf";

const mockCreate       = vi.mocked(createClient);
const mockCheckRL      = vi.mocked(checkRateLimit);
const mockVerifyOrigin = vi.mocked(verifyOrigin);

const USER_ID    = "user-aaaaaaaa-0000-0000-0000-000000000000";
const CONTACT_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

const CONTACT_ROW = {
  id: CONTACT_ID, user_id: USER_ID, name: "Alice", outreach_status: "Connected",
  last_contacted_at: "2026-07-01T00:00:00Z",
};

function makeClient(user: unknown = { id: USER_ID }, rows: unknown[] = [CONTACT_ROW]) {
  const chain = makeChain({ data: rows[0] ?? null, error: null });
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    from: vi.fn().mockReturnValue(chain),
  };
}

function req(id: string, body?: unknown) {
  return new Request(`http://localhost/api/networking/contacts/${id}/outreach`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRL.mockReturnValue({ allowed: true, remaining: 9, resetTime: Date.now() + 60_000 });
  mockCreate.mockResolvedValue(makeClient() as never);
  mockVerifyOrigin.mockReturnValue(true);
});

describe("PATCH /api/networking/contacts/[id]/outreach", () => {
  it("returns 200 and updated contact on success", async () => {
    const res = await PATCH(
      req(CONTACT_ID, { outreach_status: "Connected" }) as never,
      { params: Promise.resolve({ id: CONTACT_ID }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.contact).toBeTruthy();
  });

  it("returns 403 when CSRF fails", async () => {
    mockVerifyOrigin.mockReturnValue(false);
    const res = await PATCH(
      req(CONTACT_ID, { outreach_status: "Connected" }) as never,
      { params: Promise.resolve({ id: CONTACT_ID }) },
    );
    expect(res.status).toBe(403);
  });

  it("returns 401 when not authenticated", async () => {
    mockCreate.mockResolvedValue(makeClient(null) as never);
    const res = await PATCH(
      req(CONTACT_ID, { outreach_status: "Connected" }) as never,
      { params: Promise.resolve({ id: CONTACT_ID }) },
    );
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRL.mockReturnValue({ allowed: false, remaining: 0, resetTime: Date.now() + 60_000 });
    const res = await PATCH(
      req(CONTACT_ID, { outreach_status: "Connected" }) as never,
      { params: Promise.resolve({ id: CONTACT_ID }) },
    );
    expect(res.status).toBe(429);
  });

  it("returns 400 for invalid outreach status", async () => {
    const res = await PATCH(
      req(CONTACT_ID, { outreach_status: "Stalking" }) as never,
      { params: Promise.resolve({ id: CONTACT_ID }) },
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for non-UUID contact ID", async () => {
    const res = await PATCH(
      req("not-a-uuid", { outreach_status: "Connected" }) as never,
      { params: Promise.resolve({ id: "not-a-uuid" }) },
    );
    expect(res.status).toBe(400);
  });

  it("update includes last_contacted_at", async () => {
    const client = makeClient({ id: USER_ID });
    mockCreate.mockResolvedValue(client as never);
    await PATCH(
      req(CONTACT_ID, { outreach_status: "Message Sent" }) as never,
      { params: Promise.resolve({ id: CONTACT_ID }) },
    );
    const chain = client.from.mock.results[0].value;
    const updateArg = chain.update.mock.calls[0]?.[0];
    expect(updateArg).toMatchObject({
      outreach_status:   "Message Sent",
      last_contacted_at: expect.any(String),
    });
  });

  it("enforces ownership via user_id eq", async () => {
    const client = makeClient({ id: USER_ID });
    mockCreate.mockResolvedValue(client as never);
    await PATCH(
      req(CONTACT_ID, { outreach_status: "Replied" }) as never,
      { params: Promise.resolve({ id: CONTACT_ID }) },
    );
    const chain = client.from.mock.results[0].value;
    expect(chain.eq).toHaveBeenCalledWith("user_id", USER_ID);
  });
});
