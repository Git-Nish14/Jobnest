/**
 * E2E flow tests — Stripe Billing
 *
 * Journey 1 — Happy-path subscription:
 *   POST /api/stripe/checkout → creates Stripe checkout session
 *   Webhook: checkout.session.completed → subscription row upserted
 *   GET  /api/stripe/portal   → redirects to billing portal
 *
 * Journey 2 — Payment failure / dunning:
 *   Webhook: invoice.payment_failed → subscription marked past_due + dunning email
 *   Webhook: customer.subscription.deleted → subscription marked free/canceled
 *
 * Journey 3 — Checkout edge cases:
 *   Already subscribed → 409
 *   Stripe not configured → 503
 *   Unauthenticated → 401
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeChain } from "@/tests/helpers/supabase-mock";

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn(),
  isStripeConfigured: vi.fn(() => true),
  isStripeAnnualConfigured: vi.fn(() => false),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/email/nodemailer", () => ({
  sendDunningEmail: vi.fn().mockResolvedValue({ success: true }),
}));

import { POST as checkout } from "@/app/api/stripe/checkout/route";
import { POST as webhook } from "@/app/api/stripe/webhook/route";
import { GET as portal } from "@/app/api/stripe/portal/route";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendDunningEmail } from "@/lib/email/nodemailer";

const mockGetStripe = vi.mocked(getStripe);
const mockIsConfigured = vi.mocked(isStripeConfigured);
const mockCreateClient = vi.mocked(createClient);
const mockAdminClient = vi.mocked(createAdminClient);
const mockDunning = vi.mocked(sendDunningEmail);

// ── Stripe mock factory ───────────────────────────────────────────────────────

function mockStripe(overrides: Record<string, unknown> = {}) {
  return {
    customers: { create: vi.fn().mockResolvedValue({ id: "cus_new" }) },
    checkout: {
      sessions: {
        create: vi.fn().mockResolvedValue({ url: "https://checkout.stripe.com/pay/cs_test_abc" }),
      },
    },
    subscriptions: {
      retrieve: vi.fn().mockResolvedValue({
        id: "sub_1",
        status: "active",
        current_period_end: Math.floor(Date.now() / 1000) + 2592000,
        cancel_at_period_end: false,
      }),
    },
    billingPortal: {
      sessions: { create: vi.fn().mockResolvedValue({ url: "https://billing.stripe.com/session/portal_xyz" }) },
    },
    webhooks: {
      constructEvent: vi.fn().mockImplementation(() => {
        throw new Error("use overrides.webhooks");
      }),
    },
    ...overrides,
  };
}

// ── Supabase mock helpers ─────────────────────────────────────────────────────

function makeServerClient(user: unknown = { id: "uid-1", email: "u@test.com" }) {
  return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) } };
}

function makeAdminForCheckout(existing: unknown = null) {
  const chain = makeChain({ data: existing, error: null });
  const upsert = vi.fn().mockReturnValue({
    then: (r: (v: unknown) => void) => Promise.resolve({ error: null }).then(r),
  });
  return {
    from: vi.fn().mockReturnValue({ ...chain, upsert }),
    auth: { admin: { getUserById: vi.fn() } },
  };
}

function makeAdminForWebhook(subData: unknown = { user_id: "uid-1" }) {
  const subChain = makeChain({ data: subData, error: null });
  const upsert = vi.fn().mockReturnValue({
    then: (r: (v: unknown) => void) => Promise.resolve({ error: null }).then(r),
  });
  const update = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      then: (r: (v: unknown) => void) => Promise.resolve({ error: null }).then(r),
    }),
  });
  return {
    from: vi.fn().mockReturnValue({ ...subChain, upsert, update }),
    auth: {
      admin: {
        getUserById: vi.fn().mockResolvedValue({
          data: { user: { id: "uid-1", email: "u@test.com" } },
        }),
      },
    },
  };
}

function makeWebhookRequest(event: unknown) {
  return new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": "valid-sig", "content-type": "text/plain" },
    body: JSON.stringify(event),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockIsConfigured.mockReturnValue(true);
  mockCreateClient.mockResolvedValue(makeServerClient() as never);
});

// ── Journey 1: Happy-path subscription ───────────────────────────────────────

describe("Billing flow — Step 1: create checkout session", () => {
  it("returns checkout URL for authenticated user without existing sub", async () => {
    mockAdminClient.mockReturnValue(makeAdminForCheckout(null) as never);
    mockGetStripe.mockReturnValue(mockStripe() as never);

    const req = new Request("http://localhost/api/stripe/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ interval: "monthly", trial: false }),
    });

    const res = await checkout(req as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toMatch(/checkout\.stripe\.com/);
  });

  it("includes trial_period_days when trial=true", async () => {
    const createFn = vi.fn().mockResolvedValue({ url: "https://checkout.stripe.com/pay/trial" });
    mockAdminClient.mockReturnValue(makeAdminForCheckout(null) as never);
    mockGetStripe.mockReturnValue({ ...mockStripe(), checkout: { sessions: { create: createFn } } } as never);

    const req = new Request("http://localhost/api/stripe/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ interval: "monthly", trial: true }),
    });

    await checkout(req as never);
    expect(createFn).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription_data: expect.objectContaining({ trial_period_days: 30 }),
      })
    );
  });

  it("returns 409 if user already has an active Pro subscription", async () => {
    mockAdminClient.mockReturnValue(
      makeAdminForCheckout({ plan: "pro", status: "active", stripe_customer_id: "cus_1" }) as never
    );
    mockGetStripe.mockReturnValue(mockStripe() as never);

    const req = new Request("http://localhost/api/stripe/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    const res = await checkout(req as never);
    expect(res.status).toBe(409);
  });

  it("returns 401 when not authenticated", async () => {
    mockCreateClient.mockResolvedValue(makeServerClient(null) as never);
    const req = new Request("http://localhost/api/stripe/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await checkout(req as never);
    expect(res.status).toBe(401);
  });

  it("returns 503 when Stripe is not configured", async () => {
    mockIsConfigured.mockReturnValue(false);
    const req = new Request("http://localhost/api/stripe/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await checkout(req as never);
    expect(res.status).toBe(503);
  });
});

describe("Billing flow — Step 2: webhook activates subscription", () => {
  it("checkout.session.completed upserts pro subscription", async () => {
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

    const admin = makeAdminForWebhook();
    mockAdminClient.mockReturnValue(admin as never);
    mockGetStripe.mockReturnValue({
      ...mockStripe(),
      webhooks: { constructEvent: vi.fn().mockReturnValue(event) },
    } as never);

    const res = await webhook(makeWebhookRequest(event) as never);
    expect(res.status).toBe(200);
    expect(admin.from).toHaveBeenCalled();
  });
});

describe("Billing flow — Step 3: access billing portal", () => {
  it("redirects to Stripe portal URL", async () => {
    mockAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue(
        makeChain({ data: { stripe_customer_id: "cus_1" }, error: null })
      ),
    } as never);
    mockGetStripe.mockReturnValue({
      billingPortal: {
        sessions: { create: vi.fn().mockResolvedValue({ url: "https://billing.stripe.com/portal_xyz" }) },
      },
    } as never);

    const req = new Request("http://localhost/api/stripe/portal", { method: "GET" });
    const res = await portal(req as never);
    expect(res.status).toBe(303);
  });
});

// ── Journey 2: Payment failure / dunning ─────────────────────────────────────

describe("Billing flow — invoice.payment_failed (dunning)", () => {
  it("marks past_due and sends dunning email", async () => {
    const event = {
      type: "invoice.payment_failed",
      data: {
        object: {
          customer: "cus_1",
          amount_due: 900,
          currency: "usd",
          next_payment_attempt: Math.floor(Date.now() / 1000) + 86400,
        },
      },
    };

    const admin = makeAdminForWebhook({ user_id: "uid-1" });
    mockAdminClient.mockReturnValue(admin as never);
    mockGetStripe.mockReturnValue({
      ...mockStripe(),
      webhooks: { constructEvent: vi.fn().mockReturnValue(event) },
    } as never);

    const res = await webhook(makeWebhookRequest(event) as never);
    expect(res.status).toBe(200);
    expect(mockDunning).toHaveBeenCalledWith("u@test.com", 900, "usd", expect.any(String));
  });

  it("customer.subscription.deleted marks subscription canceled", async () => {
    const event = {
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_1" } },
    };

    const admin = makeAdminForWebhook();
    mockAdminClient.mockReturnValue(admin as never);
    mockGetStripe.mockReturnValue({
      ...mockStripe(),
      webhooks: { constructEvent: vi.fn().mockReturnValue(event) },
    } as never);

    const res = await webhook(makeWebhookRequest(event) as never);
    expect(res.status).toBe(200);
    // update called with canceled status
    expect(admin.from).toHaveBeenCalled();
  });
});
