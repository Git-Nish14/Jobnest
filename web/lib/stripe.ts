import Stripe from "stripe";

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  if (!stripeInstance) {
    stripeInstance = new Stripe(key, {
      apiVersion: "2026-03-25.dahlia",
    });
  }
  return stripeInstance;
}

export function isStripeConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRO_PRICE_ID
  );
}

export function isStripeAnnualConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRO_ANNUAL_PRICE_ID
  );
}
