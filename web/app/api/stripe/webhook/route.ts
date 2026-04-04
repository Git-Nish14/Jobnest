import { NextRequest } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendDunningEmail } from "@/lib/email/nodemailer";
import type Stripe from "stripe";

// App Router does NOT auto-parse the request body, so request.text() always
// returns the raw bytes Stripe needs for signature verification — no extra config required.

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return new Response("Webhook not configured", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("[stripe/webhook] Invalid signature:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  const supabaseAdmin = createAdminClient();

  try {
    switch (event.type) {
      // ── Checkout completed ──────────────────────────────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription" || !session.subscription) break;

        const userId = session.client_reference_id;
        if (!userId) break;

        const stripe = getStripe();
        const sub = await stripe.subscriptions.retrieve(
          session.subscription as string
        );

        await supabaseAdmin.from("subscriptions").upsert(
          {
            user_id: userId,
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: sub.id,
            plan: "pro",
            status: sub.status,
            current_period_end: new Date(
              (sub as unknown as { current_period_end: number }).current_period_end * 1000
            ).toISOString(),
            cancel_at_period_end: sub.cancel_at_period_end,
          },
          { onConflict: "user_id" }
        );
        break;
      }

      // ── Subscription updated (renewals, plan changes) ───────────────────────
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const userId =
          (sub.metadata as Record<string, string>).supabase_user_id;
        if (!userId) break;

        await supabaseAdmin.from("subscriptions").upsert(
          {
            user_id: userId,
            stripe_customer_id: sub.customer as string,
            stripe_subscription_id: sub.id,
            plan: sub.status === "active" ? "pro" : "free",
            status: sub.status,
            current_period_end: new Date(
              (sub as unknown as { current_period_end: number }).current_period_end * 1000
            ).toISOString(),
            cancel_at_period_end: sub.cancel_at_period_end,
          },
          { onConflict: "user_id" }
        );
        break;
      }

      // ── Subscription canceled / expired ────────────────────────────────────
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await supabaseAdmin
          .from("subscriptions")
          .update({
            plan: "free",
            status: "canceled",
            stripe_subscription_id: null,
            cancel_at_period_end: false,
          })
          .eq("stripe_subscription_id", sub.id);
        break;
      }

      // ── Payment failed — trigger dunning email ─────────────────────────────
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        // Look up the user by Stripe customer ID
        const { data: sub } = await supabaseAdmin
          .from("subscriptions")
          .select("user_id, status")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (!sub?.user_id) break;

        // Mark subscription as past_due
        await supabaseAdmin
          .from("subscriptions")
          .update({ status: "past_due" })
          .eq("stripe_customer_id", customerId);

        // Look up the user's email
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(
          sub.user_id
        );
        if (!authUser.user?.email) break;

        // Calculate next retry date from Stripe's next_payment_attempt
        const nextRetry = (invoice as unknown as { next_payment_attempt: number | null })
          .next_payment_attempt;
        const nextRetryDate = nextRetry
          ? new Date(nextRetry * 1000).toISOString()
          : null;

        await sendDunningEmail(
          authUser.user.email,
          invoice.amount_due,
          invoice.currency,
          nextRetryDate
        );

        console.log(`[stripe/webhook] Dunning email sent to ${authUser.user.email}`);
        break;
      }

      default:
        break;
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("[stripe/webhook] Error processing event:", err);
    return new Response("Processing error", { status: 500 });
  }
}
