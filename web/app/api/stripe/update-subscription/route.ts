import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { ApiError, errorResponse, successResponse, validateBody } from "@/lib/api/errors";
import { verifyOrigin } from "@/lib/security/csrf";

const schema = z.object({
  interval: z.enum(["monthly", "annual"]),
});

export async function POST(request: NextRequest) {
  try {
    if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin.");
    if (!isStripeConfigured()) throw ApiError.serviceUnavailable("Billing is not configured.");

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const { interval } = await validateBody(request, schema);

    // Resolve target price ID
    const newPriceId =
      interval === "annual"
        ? process.env.STRIPE_PRO_ANNUAL_PRICE_ID
        : process.env.STRIPE_PRO_PRICE_ID;

    if (!newPriceId) {
      throw ApiError.serviceUnavailable(
        interval === "annual"
          ? "Annual billing is not yet available."
          : "Monthly price is not configured."
      );
    }

    const supabaseAdmin = createAdminClient();

    // Look up their current Stripe subscription
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_subscription_id, plan, status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!sub?.stripe_subscription_id) {
      throw ApiError.notFound("No active subscription found. Subscribe first via the pricing page.");
    }
    if (sub.plan !== "pro" || sub.status !== "active") {
      throw ApiError.conflict("Only active Pro subscriptions can be updated here.");
    }

    const stripe = getStripe();

    // Retrieve the live Stripe subscription and its current item
    const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id, {
      expand: ["items.data.price"],
    });

    if (stripeSub.status !== "active" && stripeSub.status !== "trialing") {
      throw ApiError.conflict("Subscription is not in an updatable state.");
    }

    const currentItem = stripeSub.items.data[0];
    if (!currentItem) throw ApiError.internal("Subscription has no items.");

    // No-op guard — don't charge a proration if already on the target price
    if (currentItem.price.id === newPriceId) {
      return successResponse({
        message: `You are already on the ${interval} billing interval.`,
        changed: false,
      });
    }

    // Update with immediate proration — Stripe creates a proration invoice
    // automatically so the customer is charged/credited fairly mid-cycle.
    const updated = await stripe.subscriptions.update(stripeSub.id, {
      items: [{ id: currentItem.id, price: newPriceId }],
      proration_behavior: "create_prorations",
    });

    // Sync the updated period to our DB
    await supabaseAdmin
      .from("subscriptions")
      .update({
        current_period_end: new Date(
          (updated as unknown as { current_period_end: number }).current_period_end * 1000
        ).toISOString(),
        cancel_at_period_end: updated.cancel_at_period_end,
      })
      .eq("user_id", user.id);

    return successResponse({
      message: `Billing interval updated to ${interval}. Any proration will appear on your next invoice.`,
      changed: true,
      interval,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
