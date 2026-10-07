import { describe, expect, it } from "vitest";
import { getSubscriptionPeriodEnd } from "@/lib/stripe-subscription";

describe("Stripe billing period compatibility", () => {
  const periodEnd = 1_800_000_000;
  const expected = new Date(periodEnd * 1000).toISOString();

  it("reads the item-level period in current API responses", () => {
    expect(getSubscriptionPeriodEnd({
      items: { data: [{ current_period_end: periodEnd }] },
    })).toBe(expected);
  });

  it("accepts older webhook payloads with a subscription-level period", () => {
    expect(getSubscriptionPeriodEnd({ current_period_end: periodEnd })).toBe(expected);
  });

  it("uses the current item period when a legacy value is also present", () => {
    expect(getSubscriptionPeriodEnd({
      current_period_end: periodEnd - 86_400,
      items: { data: [{ current_period_end: periodEnd }] },
    })).toBe(expected);
  });

  it("rejects a missing billing period instead of writing an invalid date", () => {
    expect(() => getSubscriptionPeriodEnd({ items: { data: [] } })).toThrow(/billing period/);
  });

  it("rejects invalid timestamps", () => {
    expect(() => getSubscriptionPeriodEnd({
      items: { data: [{ current_period_end: Number.NaN }] },
    })).toThrow(/billing period/);
  });
});
