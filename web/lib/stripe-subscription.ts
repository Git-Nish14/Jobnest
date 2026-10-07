// Pro subscriptions have one price item. Older webhook endpoints can still
// deliver the legacy subscription-level field after the SDK is upgraded.
export function getSubscriptionPeriodEnd(subscription: {
  items?: { data: { current_period_end: number }[] };
  current_period_end?: number;
}): string {
  const periodEnd = subscription.items?.data[0]?.current_period_end
    ?? subscription.current_period_end;
  if (typeof periodEnd !== "number" || !Number.isFinite(periodEnd)) {
    throw new Error("Stripe subscription is missing a valid billing period end.");
  }
  return new Date(periodEnd * 1000).toISOString();
}
