-- Fix remaining Supabase security linter warnings
-- 1. update_job_applications_search_vector: migration 040's CREATE OR REPLACE reset
--    the SET search_path applied by migration 038's ALTER — re-apply it inline.
-- 2. SECURITY DEFINER functions: re-apply REVOKE for any grants that survived later
--    CREATE OR REPLACE calls, and lock down admin-only functions completely.

-- ============================================================
-- 1. SEARCH PATH FIX
--    Recreate with SET search_path so the linter can't detect a mutable path.
--    This is a trigger function — SECURITY INVOKER is correct (no elevated access needed).
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_job_applications_search_vector()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
    NEW.search_vector := to_tsvector(
        'english',
        coalesce(NEW.company, '') || ' ' ||
        coalesce(NEW.position, '') || ' ' ||
        coalesce(NEW.job_id, '') || ' ' ||
        coalesce(NEW.location, '') || ' ' ||
        coalesce(NEW.notes, '')
    );
    RETURN NEW;
END;
$$;

-- ============================================================
-- 2. ADMIN-ONLY / TRIGGER-ONLY FUNCTIONS
--    These are never meant to be called via /rest/v1/rpc by any client.
--    Revoke EXECUTE from both anon and authenticated.
-- ============================================================

-- Trigger: fires on job_applications INSERT/UPDATE
REVOKE EXECUTE ON FUNCTION public.log_application_activity() FROM anon, authenticated;

-- Trigger: fires when application status changes to Rejected
REVOKE EXECUTE ON FUNCTION public.schedule_document_purge() FROM anon, authenticated;

-- Trigger: fires on profiles INSERT to seed email templates
REVOKE EXECUTE ON FUNCTION public.create_default_email_templates() FROM anon, authenticated;

-- Trigger: keeps subscriptions.updated_at current
REVOKE EXECUTE ON FUNCTION public.update_subscriptions_updated_at() FROM anon, authenticated;

-- Cron / Edge Function target: deletes expired OTP rows
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_otps() FROM anon, authenticated;

-- Cron / Edge Function target: placeholder for orphaned storage cleanup
REVOKE EXECUTE ON FUNCTION public.cleanup_orphaned_files() FROM anon, authenticated;

-- Supabase-internal helper (may not exist in all environments)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM   pg_proc p
        JOIN   pg_namespace n ON n.oid = p.pronamespace
        WHERE  n.nspname = 'public'
          AND  p.proname = 'rls_auto_enable'
          AND  p.pronargs = 0
    ) THEN
        REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated;
    END IF;
END;
$$;

-- ============================================================
-- 3. USER-CALLABLE FUNCTIONS — remove anon access only
--    authenticated users legitimately call these via RPC or RLS policies.
-- ============================================================

-- Rate-limit guard called before creating an application
REVOKE EXECUTE ON FUNCTION public.check_application_rate_limit() FROM anon;

-- Stats used on the dashboard
REVOKE EXECUTE ON FUNCTION public.get_user_application_count() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_application_stats() FROM anon;

-- Used in RLS policies and storage bucket policies
REVOKE EXECUTE ON FUNCTION public.user_owns_application(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_owns_application(text) FROM anon;
