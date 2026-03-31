/**
 * Unit tests — POST /api/stripe/webhook
 *
 * Covers:
 *  - Signature verification (reject bad / missing signature)
 *  - checkout.session.completed  → upsert subscription as pro/active
 *  - customer.subscription.updated → sync plan + status
 *  - customer.subscription.deleted → mark free/canceled
 *  - invoice.payment_failed       → mark past_due + send dunning email
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeChain } from "@/tests/helpers/supabase-mock";

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

vi.mock("@/lib/email/nodemailer", () => ({
  sendDunningEmail: vi.fn().mockResolvedValue({ success: true }),
}));

import { POST } from "@/app/api/stripe/webhook/route";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendDunningEmail } from "@/lib/email/nodemailer";

const mockGetStripe = vi.mocked(getStripe);
const mockAdminClient = vi.mocked(createAdminClient);
const mockDunningEmail = vi.mocked(sendDunningEmail);

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeStripe(event: unknown, subscriptionData?: unknown) {
  return {
    webhooks: {
      constructEvent: vi.fn().mockReturnValue(event),
    },
    subscriptions: {
      retrieve: vi.fn().mockResolvedValue(subscriptionData ?? {}),
    },
  };
}

function makeWebhookRequest(body: string, signature = "valid-sig") {
  return new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers: {
      "stripe-signature": signature,
      "content-type": "text/plain",
    },
    body,
  });
}

function makeAdmin() {
  const subChain = makeChain({ data: { user_id: "uid-1", status: "active" }, error: null });
  return {
    from: vi.fn().mockReturnValue({
      ...subChain,
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          then: (r: (v: unknown) => void) => Promise.resolve({ error: null }).then(r),
        }),
      }),
      upsert: vi.fn().mockReturnValue({
        then: (r: (v: unknown) => void) => Promise.resolve({ error: null }).then(r),
      }),
    }),
    auth: {
      admin: {
        getUserById: vi.fn().mockResolvedValue({
          data: { user: { id: "uid-1", email: "user@test.com" } },
        }),
      },
    },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/stripe/webhook — signature verification", () => {
  it("returns 400 when stripe-signature header is missing", async () => {
    const req = new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      body: "{}",
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
    expect(await res.text()).toMatch(/not configured/i);
  });

  it("returns 400 when constructEvent throws (bad signature)", async () => {
    mockGetStripe.mockReturnValue({
      webhooks: {
        constructEvent: vi.fn().mockImplementation(() => {
          throw new Error("No signatures found matching");
        }),
      },
    } as never);

    const req = makeWebhookRequest("{}", "bad-sig");
    const res = await POST(req as never);
    expect(res.status).toBe(400);
    expect(await res.text()).toMatch(/invalid signature/i);
  });
});

describe("POST /api/stripe/webhook — checkout.session.completed", () => {
  it("upserts subscription as pro/active on successful checkout", async () => {
    const sub = {
      id: "sub_1",
      status: "active",
      current_period_end: Math.floor(Date.now() / 1000) + 2592000,
      cancel_at_period_end: false,
    };
    const event = {
      type: "checkout.session.completed",
      data: {
        object: {
          mode: "subscription",
          subscription: "sub_1",
          customer: "cus_1",
          client_reference_id: "uid-1",
        },
      },
    };

    const admin = makeAdmin();
    const upsertFn = vi.fn().mockReturnValue({
      then: (r: (v: unknown) => void) => Promise.resolve({ error: null }).then(r),
    });
    admin.from = vi.fn().mockReturnValue({ upsert: upsertFn });

    mockGetStripe.mockReturnValue(makeStripe(event, sub) as never);
    mockAdminClient.mockReturnValue(admin as never);

    const req = makeWebhookRequest(JSON.stringify(event));
    const res = await POST(req as never);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("OK");
    expect(upsertFn).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "uid-1", plan: "pro", status: "active" }),
      expect.anything()
    );
  });

  it("ignores non-subscription checkout sessions", async () => {
    const event = {
      type: "checkout.session.completed",
      data: { object: { mode: "payment", subscription: null, client_reference_id: "uid-1" } },
    };
    mockGetStripe.mockReturnValue(makeStripe(event) as never);
    mockAdminClient.mockReturnValue(makeAdmin() as never);

    const req = makeWebhookRequest(JSON.stringify(event));
    const res = await POST(req as never);
    expect(res.status).toBe(200);
  });
});

describe("POST /api/stripe/webhook — customer.subscription.updated", () => {
  it("syncs plan to pro when status is active", async () => {
    const sub = {
      id: "sub_1",
      status: "active",
      customer: "cus_1",
      metadata: { supabase_user_id: "uid-1" },
      current_period_end: Math.floor(Date.now() / 1000) + 2592000,
      cancel_at_period_end: false,
    };
    const event = { type: "customer.subscription.updated", data: { object: sub } };

    const admin = makeAdmin();
    const upsertFn = vi.fn().mockReturnValue({
      then: (r: (v: unknown) => void) => Promise.resolve({ error: null }).then(r),
    });
    admin.from = vi.fn().mockReturnValue({ upsert: upsertFn });

    mockGetStripe.mockReturnValue(makeStripe(event) as never);
    mockAdminClient.mockReturnValue(admin as never);

    const req = makeWebhookRequest(JSON.stringify(event));
    const res = await POST(req as never);
    expect(res.status).toBe(200);
    expect(upsertFn).toHaveBeenCalledWith(
      expect.objectContaining({ plan: "pro", status: "active" }),
      expect.anything()
    );
  });

  it("sets plan to free when status is past_due", async () => {
    const sub = {
      id: "sub_1",
      status: "past_due",
      customer: "cus_1",
      metadata: { supabase_user_id: "uid-1" },
      current_period_end: Math.floor(Date.now() / 1000) + 2592000,
      cancel_at_period_end: false,
    };
    const event = { type: "customer.subscription.updated", data: { object: sub } };

    const admin = makeAdmin();
    const upsertFn = vi.fn().mockReturnValue({
      then: (r: (v: unknown) => void) => Promise.resolve({ error: null }).then(r),
    });
    admin.from = vi.fn().mockReturnValue({ upsert: upsertFn });

    mockGetStripe.mockReturnValue(makeStripe(event) as never);
    mockAdminClient.mockReturnValue(admin as never);

    const req = makeWebhookRequest(JSON.stringify(event));
    const res = await POST(req as never);
    expect(res.status).toBe(200);
    expect(upsertFn).toHaveBeenCalledWith(
      expect.objectContaining({ plan: "free", status: "past_due" }),
      expect.anything()
    );
  });
});

describe("POST /api/stripe/webhook — customer.subscription.deleted", () => {
  it("marks subscription as free/canceled", async () => {
    const sub = { id: "sub_1" };
    const event = { type: "customer.subscription.deleted", data: { object: sub } };

    const admin = makeAdmin();
    const updateFn = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        then: (r: (v: unknown) => void) => Promise.resolve({ error: null }).then(r),
      }),
    });
    admin.from = vi.fn().mockReturnValue({ update: updateFn });

    mockGetStripe.mockReturnValue(makeStripe(event) as never);
    mockAdminClient.mockReturnValue(admin as never);

    const req = makeWebhookRequest(JSON.stringify(event));
    const res = await POST(req as never);
    expect(res.status).toBe(200);
    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({ plan: "free", status: "canceled" })
    );
  });
});

describe("POST /api/stripe/webhook — invoice.payment_failed (dunning)", () => {
  it("marks subscription past_due and sends dunning email", async () => {
    const invoice = {
      customer: "cus_1",
      amount_due: 900,
      currency: "usd",
      next_payment_attempt: Math.floor(Date.now() / 1000) + 86400,
    };
    const event = { type: "invoice.payment_failed", data: { object: invoice } };

    const admin = makeAdmin();
    // from("subscriptions").select(...).eq(...).maybeSingle() → returns user_id
    const subChain = makeChain({ data: { user_id: "uid-1", status: "active" }, error: null });
    const updateFn = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        then: (r: (v: unknown) => void) => Promise.resolve({ error: null }).then(r),
      }),
    });
    admin.from = vi.fn((table: string) => {
      if (table === "subscriptions") return { ...subChain, update: updateFn };
      return makeChain();
    });

    mockGetStripe.mockReturnValue(makeStripe(event) as never);
    mockAdminClient.mockReturnValue(admin as never);

    const req = makeWebhookRequest(JSON.stringify(event));
    const res = await POST(req as never);
    expect(res.status).toBe(200);

    // Subscription marked past_due
    expect(updateFn).toHaveBeenCalledWith({ status: "past_due" });

    // Dunning email sent
    expect(mockDunningEmail).toHaveBeenCalledWith(
      "user@test.com",
      900,
      "usd",
      expect.any(String)
    );
  });

  it("handles null next_payment_attempt (no more retries)", async () => {
    const invoice = {
      customer: "cus_1",
      amount_due: 1500,
      currency: "gbp",
      next_payment_attempt: null,
    };
    const event = { type: "invoice.payment_failed", data: { object: invoice } };
    const admin = makeAdmin();
    const subChain = makeChain({ data: { user_id: "uid-1" }, error: null });
    const updateFn = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        then: (r: (v: unknown) => void) => Promise.resolve({ error: null }).then(r),
      }),
    });
    admin.from = vi.fn((table: string) => {
      if (table === "subscriptions") return { ...subChain, update: updateFn };
      return makeChain();
    });
    mockGetStripe.mockReturnValue(makeStripe(event) as never);
    mockAdminClient.mockReturnValue(admin as never);

    const req = makeWebhookRequest(JSON.stringify(event));
    const res = await POST(req as never);
    expect(res.status).toBe(200);
    expect(mockDunningEmail).toHaveBeenCalledWith("user@test.com", 1500, "gbp", null);
  });

  it("does not send email when customer has no subscription record", async () => {
    const invoice = {
      customer: "cus_unknown",
      amount_due: 900,
      currency: "usd",
      next_payment_attempt: null,
    };
    const event = { type: "invoice.payment_failed", data: { object: invoice } };
    const admin = makeAdmin();
    // No subscription found
    const emptyChain = makeChain({ data: null, error: { message: "not found" } });
    admin.from = vi.fn().mockReturnValue(emptyChain);

    mockGetStripe.mockReturnValue(makeStripe(event) as never);
    mockAdminClient.mockReturnValue(admin as never);

    const req = makeWebhookRequest(JSON.stringify(event));
    const res = await POST(req as never);
    expect(res.status).toBe(200);
    expect(mockDunningEmail).not.toHaveBeenCalled();
  });

  it("returns 200 for unknown event types (graceful no-op)", async () => {
    const event = { type: "unknown.event.type", data: { object: {} } };
    mockGetStripe.mockReturnValue(makeStripe(event) as never);
    mockAdminClient.mockReturnValue(makeAdmin() as never);

    const req = makeWebhookRequest(JSON.stringify(event));
    const res = await POST(req as never);
    expect(res.status).toBe(200);
  });
});
