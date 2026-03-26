import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { ApiError, errorResponse, successResponse } from "@/lib/api/errors";
import type Stripe from "stripe";

export async function POST(request: NextRequest) {
  try {
    if (!isStripeConfigured()) {
      throw ApiError.serviceUnavailable(
        "Stripe is not configured. Please contact support."
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw ApiError.unauthorized();

    // Optional body: { interval?: "monthly" | "annual", trial?: boolean }
    const body = await request.json().catch(() => ({}));
    const useAnnual =
      body.interval === "annual" &&
      Boolean(process.env.STRIPE_PRO_ANNUAL_PRICE_ID);
    const trial = body.trial === true;

    const priceId = useAnnual
      ? process.env.STRIPE_PRO_ANNUAL_PRICE_ID!
      : process.env.STRIPE_PRO_PRICE_ID!;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const stripe = getStripe();
    const supabaseAdmin = createAdminClient();

    // Find existing Stripe customer for this user
    const { data: existing } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_customer_id, plan, status")
      .eq("user_id", user.id)
      .maybeSingle();

    // Block duplicate active subscriptions
    if (existing?.plan === "pro" && existing?.status === "active") {
      throw ApiError.conflict("You already have an active Pro subscription.");
    }

    let customerId = existing?.stripe_customer_id ?? undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
    }

    const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData =
      { metadata: { supabase_user_id: user.id } };

    if (trial) {
      subscriptionData.trial_period_days = 30;
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/pricing?success=true`,
      cancel_url: `${appUrl}/pricing?canceled=true`,
      client_reference_id: user.id,
      subscription_data: subscriptionData,
      allow_promotion_codes: true,
    });

    return successResponse({ url: session.url });
  } catch (err) {
    return errorResponse(err);
  }
}
