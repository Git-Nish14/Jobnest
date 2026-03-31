import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { ApiError, errorResponse } from "@/lib/api/errors";

export async function GET() {
  try {
    if (!isStripeConfigured()) {
      throw ApiError.serviceUnavailable("Billing is not configured.");
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw ApiError.unauthorized();

    const supabaseAdmin = createAdminClient();
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!sub?.stripe_customer_id) {
      throw ApiError.notFound("No active subscription found. Subscribe first to manage billing.");
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const stripe = getStripe();

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${appUrl}/profile`,
    });

    return NextResponse.redirect(session.url, { status: 303 });
  } catch (err) {
    // For redirect errors, return JSON so the client can handle it gracefully
    return errorResponse(err);
  }
}
