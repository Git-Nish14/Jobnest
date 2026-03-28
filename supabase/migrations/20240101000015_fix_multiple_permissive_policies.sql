-- Migration: Fix Multiple Permissive Policies warnings
-- Description:
--   1. job_applications — drops ALL existing policies dynamically (handles any name drift
--      between migration files and live DB) then recreates exactly 4 clean policies.
--   2. subscriptions — the FOR ALL service_role policy lacked a TO service_role role
--      restriction, causing it to overlap with the FOR SELECT user policy on every command.

-- =============================================
-- job_applications: drop every policy regardless of name
-- =============================================
DO $$
DECLARE
    pol text;
BEGIN
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'job_applications'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.job_applications', pol);
    END LOOP;
END $$;

CREATE POLICY "Users can view own applications" ON public.job_applications
    FOR SELECT TO authenticated
    USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own applications" ON public.job_applications
    FOR INSERT TO authenticated
    WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own applications" ON public.job_applications
    FOR UPDATE TO authenticated
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own applications" ON public.job_applications
    FOR DELETE TO authenticated
    USING ((select auth.uid()) = user_id);

-- =============================================
-- subscriptions: scope service_role policy to service_role only
-- =============================================
DROP POLICY IF EXISTS "users_view_own_subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "service_role_manage_subscriptions" ON public.subscriptions;

-- Users read their own row
CREATE POLICY "users_view_own_subscription" ON public.subscriptions
    FOR SELECT TO authenticated
    USING ((select auth.uid()) = user_id);

-- Service role (Stripe webhooks) gets full write access — scoped to service_role only
-- so it does NOT overlap with the authenticated SELECT policy above
CREATE POLICY "service_role_manage_subscriptions" ON public.subscriptions
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);
