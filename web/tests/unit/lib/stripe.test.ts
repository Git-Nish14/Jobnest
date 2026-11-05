import { afterEach, describe, expect, it, vi } from "vitest";
import { getStripe } from "@/lib/stripe";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Stripe SDK compatibility", () => {
  it("sends the reviewed API version on real SDK requests", async () => {
    const stripe = getStripe();
    const request = vi.spyOn(stripe.getApiField("httpClient"), "makeRequest")
      .mockResolvedValue({
        getStatusCode: () => 200,
        getHeaders: () => ({}),
        getRawResponse: () => ({}),
        toStream: () => null,
        toJSON: async () => ({ id: "cus_review", object: "customer" }),
      });

    const customer = await stripe.customers.retrieve("cus_review");

    expect(customer.id).toBe("cus_review");
    expect(request).toHaveBeenCalledOnce();
    expect(request.mock.calls[0][4]).toMatchObject({
      "Stripe-Version": "2026-10-28.endive",
    });
  });

  it.each(["2026-09-30.endive", "2026-10-28.endive"])(
    "verifies signed webhook payloads from API version %s",
    (apiVersion) => {
      const stripe = getStripe();
      const secret = "whsec_dependency_review";
      const payload = JSON.stringify({
        id: "evt_review",
        object: "event",
        type: "customer.subscription.updated",
        api_version: apiVersion,
        data: { object: { id: "sub_review", object: "subscription" } },
      });
      const header = stripe.webhooks.generateTestHeaderString({ payload, secret });

      const event = stripe.webhooks.constructEvent(payload, header, secret);

      expect(event.api_version).toBe(apiVersion);
      expect(event.type).toBe("customer.subscription.updated");
      expect(event.data.object.id).toBe("sub_review");
      expect(() => stripe.webhooks.constructEvent(`${payload} `, header, secret))
        .toThrow(/signature/i);
    },
  );
});
