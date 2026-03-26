-- Migration 10: Subscriptions table for Stripe billing

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  stripe_customer_id text UNIQUE,
  stripe_subscription_id text UNIQUE,
  plan text NOT NULL DEFAULT 'free',       -- 'free' | 'pro'
  status text NOT NULL DEFAULT 'active',   -- Stripe status: 'active' | 'canceled' | 'past_due' etc.
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can view their own subscription
CREATE POLICY "users_view_own_subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role (webhooks) may write
CREATE POLICY "service_role_manage_subscriptions"
  ON public.subscriptions FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_customer ON public.subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_stripe_subscription ON public.subscriptions(stripe_subscription_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_subscriptions_updated_at();
