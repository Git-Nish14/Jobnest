import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeRequest, makeChain } from "@/tests/helpers/supabase-mock";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/email/nodemailer", () => ({
  sendAccountReactivatedEmail: vi.fn().mockResolvedValue({ success: true }),
}));

import { POST } from "@/app/api/profile/reactivate-account/route";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const mockCreateClient = vi.mocked(createClient);
const mockAdminClient = vi.mocked(createAdminClient);

function makeServerClient(user: unknown = { id: "uid", email: "a@b.com" }) {
  return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) } };
}

/**
 * Builds an admin mock that correctly handles both:
 * - SELECT → .from().select().eq().is().single() → resolves to pendingRecord
 * - UPDATE → .from().update().eq()               → resolves to { error: updateErr }
 *
 * The key: we keep the read-chain's `self` intact so chainable select/eq/is/single
 * all resolve against the same object, and only override `update` on the returned object.
 */
function makeAdmin(pendingRecord: unknown = null, updateErr: unknown = null) {
  // read chain resolves .single() to the pendingRecord
  const readChain = makeChain({
    data: pendingRecord,
    error: pendingRecord ? null : { message: "not found" },
  });

  // update chain: .update({}).eq("id", x) resolves to { error: updateErr }
  const writeResult = { error: updateErr };
  const writeEqFn = vi.fn().mockReturnValue({
    then: (resolve: (v: unknown) => void, reject: (r: unknown) => void) =>
      Promise.resolve(writeResult).then(resolve, reject),
  });
  const updateFn = vi.fn().mockReturnValue({ eq: writeEqFn });

  // Compose: readChain handles all SELECT path; updateFn replaces only update
  const combined = Object.assign(Object.create(null), readChain, { update: updateFn });

  return { from: vi.fn().mockReturnValue(combined) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateClient.mockResolvedValue(makeServerClient() as never);
});

describe("POST /api/profile/reactivate-account", () => {
  it("returns 401 when not authenticated", async () => {
    mockCreateClient.mockResolvedValue(makeServerClient(null) as never);
    mockAdminClient.mockReturnValue(makeAdmin() as never);
    const req = makeRequest("/api/profile/reactivate-account", {});
    const res = await POST(req as never);
    expect(res.status).toBe(401);
  });

  it("returns 404 when no pending deletion found", async () => {
    mockAdminClient.mockReturnValue(makeAdmin(null) as never);
    const req = makeRequest("/api/profile/reactivate-account", {});
    const res = await POST(req as never);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/no pending deletion/i);
  });

  it("returns 200 on successful reactivation", async () => {
    const pending = { id: "del-id", email: "a@b.com" };
    mockAdminClient.mockReturnValue(makeAdmin(pending, null) as never);
    const req = makeRequest("/api/profile/reactivate-account", {});
    const res = await POST(req as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/reactivated/i);
  });

  it("returns 500 when database update fails", async () => {
    const pending = { id: "del-id", email: "a@b.com" };
    mockAdminClient.mockReturnValue(makeAdmin(pending, { message: "db error" }) as never);
    const req = makeRequest("/api/profile/reactivate-account", {});
    const res = await POST(req as never);
    expect(res.status).toBe(500);
  });
});
