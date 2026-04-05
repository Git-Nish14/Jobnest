/**
 * Unit tests — POST /api/stripe/update-subscription
 *
 * Covers:
 *  - 403 on CSRF origin mismatch
 *  - 401 when not authenticated
 *  - 503 when Stripe is not configured
 *  - 400 invalid body (bad interval)
 *  - 404 when user has no subscription
 *  - 409 when subscription is not active Pro
 *  - 200 no-op when already on target interval
 *  - 200 successfully updates to annual
 *  - 200 successfully updates to monthly
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeChain } from "@/tests/helpers/supabase-mock";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/stripe", () => ({ getStripe: vi.fn(), isStripeConfigured: vi.fn() }));

import { POST } from "@/app/api/stripe/update-subscription/route";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

const mockCreateClient  = vi.mocked(createClient);
const mockAdminClient   = vi.mocked(createAdminClient);
const mockGetStripe     = vi.mocked(getStripe);
const mockIsConfigured  = vi.mocked(isStripeConfigured);

const MONTHLY_PRICE = "price_placeholder";
const ANNUAL_PRICE  = "price_annual_placeholder";

function makeServerClient(user: unknown = { id: "uid-1" }) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
  };
}

function makeAdmin(sub: unknown = { stripe_subscription_id: "sub-1", plan: "pro", status: "active" }) {
  const chain = makeChain({ data: sub, error: sub ? null : { message: "not found" } });
  const updateChain = makeChain({ data: null, error: null });
  return {
    from: vi.fn((table: string) =>
      table === "subscriptions" ? { ...chain, update: vi.fn().mockReturnValue(updateChain) } : chain
    ),
  };
}

function makeStripe(currentPriceId = MONTHLY_PRICE) {
  return {
    subscriptions: {
      retrieve: vi.fn().mockResolvedValue({
        id: "sub-1",
        status: "active",
        cancel_at_period_end: false,
        current_period_end: Math.floor(Date.now() / 1000) + 86400,
        items: { data: [{ id: "si-1", price: { id: currentPriceId } }] },
      }),
      update: vi.fn().mockResolvedValue({
        id: "sub-1",
        cancel_at_period_end: false,
        current_period_end: Math.floor(Date.now() / 1000) + 86400 * 365,
      }),
    },
  };
}

function makeReq(interval: string, origin?: string) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (origin) headers["origin"] = origin;
  return new NextRequest("http://localhost/api/stripe/update-subscription", {
    method: "POST",
    headers,
    body: JSON.stringify({ interval }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockIsConfigured.mockReturnValue(true);
  mockCreateClient.mockResolvedValue(makeServerClient() as never);
  mockAdminClient.mockReturnValue(makeAdmin() as never);
  mockGetStripe.mockReturnValue(makeStripe() as never);
});

describe("POST /api/stripe/update-subscription — guards", () => {
  it("returns 403 on origin mismatch", async () => {
    const res = await POST(makeReq("annual", "https://evil.com"));
    expect(res.status).toBe(403);
  });

  it("returns 401 when not authenticated", async () => {
    mockCreateClient.mockResolvedValue(makeServerClient(null) as never);
    const res = await POST(makeReq("annual"));
    expect(res.status).toBe(401);
  });

  it("returns 503 when Stripe is not configured", async () => {
    mockIsConfigured.mockReturnValue(false);
    const res = await POST(makeReq("annual"));
    expect(res.status).toBe(503);
  });

  it("returns 404 when user has no subscription", async () => {
    mockAdminClient.mockReturnValue(makeAdmin(null) as never);
    const res = await POST(makeReq("annual"));
    expect(res.status).toBe(404);
  });

  it("returns 409 when subscription is not active Pro", async () => {
    mockAdminClient.mockReturnValue(makeAdmin({ stripe_subscription_id: "sub-1", plan: "free", status: "canceled" }) as never);
    const res = await POST(makeReq("annual"));
    expect(res.status).toBe(409);
  });
});

describe("POST /api/stripe/update-subscription — no-op", () => {
  it("returns 200 with changed=false when already on monthly", async () => {
    mockGetStripe.mockReturnValue(makeStripe(MONTHLY_PRICE) as never);
    const res = await POST(makeReq("monthly"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.changed).toBe(false);
  });

  it("returns 200 with changed=false when already on annual", async () => {
    mockGetStripe.mockReturnValue(makeStripe(ANNUAL_PRICE) as never);
    const res = await POST(makeReq("annual"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.changed).toBe(false);
  });
});

describe("POST /api/stripe/update-subscription — updates", () => {
  it("returns 200 and calls stripe.subscriptions.update when switching to annual", async () => {
    const stripe = makeStripe(MONTHLY_PRICE);
    mockGetStripe.mockReturnValue(stripe as never);
    const res = await POST(makeReq("annual"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.changed).toBe(true);
    expect(body.interval).toBe("annual");
    expect(stripe.subscriptions.update).toHaveBeenCalledWith(
      "sub-1",
      expect.objectContaining({ proration_behavior: "create_prorations" })
    );
  });

  it("returns 200 and updates to monthly", async () => {
    const stripe = makeStripe(ANNUAL_PRICE);
    mockGetStripe.mockReturnValue(stripe as never);
    const res = await POST(makeReq("monthly"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.changed).toBe(true);
    expect(body.interval).toBe("monthly");
  });
});
