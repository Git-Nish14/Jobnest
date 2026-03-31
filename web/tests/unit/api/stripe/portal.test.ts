/**
 * Unit tests — GET /api/stripe/portal
 *
 * Covers:
 *  - 401 when not authenticated
 *  - 503 when Stripe is not configured
 *  - 404 when user has no stripe_customer_id
 *  - 303 redirect to Stripe billing portal URL
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeChain } from "@/tests/helpers/supabase-mock";

vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn(),
  isStripeConfigured: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { GET } from "@/app/api/stripe/portal/route";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const mockGetStripe = vi.mocked(getStripe);
const mockIsConfigured = vi.mocked(isStripeConfigured);
const mockCreateClient = vi.mocked(createClient);
const mockAdminClient = vi.mocked(createAdminClient);

function makeServerClient(user: unknown = { id: "uid-1", email: "u@test.com" }) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
  };
}

function makeAdmin(customerId: string | null) {
  return {
    from: vi.fn().mockReturnValue(
      makeChain({ data: customerId ? { stripe_customer_id: customerId } : null, error: null })
    ),
  };
}

function makeRequest() {
  return new Request("http://localhost/api/stripe/portal", { method: "GET" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockIsConfigured.mockReturnValue(true);
  mockCreateClient.mockResolvedValue(makeServerClient() as never);
});

describe("GET /api/stripe/portal", () => {
  it("returns 503 when Stripe is not configured", async () => {
    mockIsConfigured.mockReturnValue(false);
    const res = await GET(makeRequest() as never);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toMatch(/not configured/i);
  });

  it("returns 401 when not authenticated", async () => {
    mockCreateClient.mockResolvedValue(makeServerClient(null) as never);
    mockAdminClient.mockReturnValue(makeAdmin(null) as never);

    const res = await GET(makeRequest() as never);
    expect(res.status).toBe(401);
  });

  it("returns 404 when user has no stripe_customer_id", async () => {
    mockAdminClient.mockReturnValue(makeAdmin(null) as never);

    const res = await GET(makeRequest() as never);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/no active subscription/i);
  });

  it("redirects to portal URL with 303 when customer exists", async () => {
    const portalUrl = "https://billing.stripe.com/session/test_portal_xyz";
    mockAdminClient.mockReturnValue(makeAdmin("cus_1") as never);
    mockGetStripe.mockReturnValue({
      billingPortal: {
        sessions: {
          create: vi.fn().mockResolvedValue({ url: portalUrl }),
        },
      },
    } as never);

    const res = await GET(makeRequest() as never);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(portalUrl);
  });

  it("passes return_url pointing to /profile", async () => {
    const createFn = vi.fn().mockResolvedValue({ url: "https://billing.stripe.com/portal" });
    mockAdminClient.mockReturnValue(makeAdmin("cus_1") as never);
    mockGetStripe.mockReturnValue({
      billingPortal: { sessions: { create: createFn } },
    } as never);

    await GET(makeRequest() as never);
    expect(createFn).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_1",
        return_url: expect.stringContaining("/profile"),
      })
    );
  });
});
