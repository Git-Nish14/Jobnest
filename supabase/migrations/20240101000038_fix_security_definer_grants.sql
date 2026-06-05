-- Migration 37: Fix SECURITY DEFINER exposure and mutable search_path warnings
--
-- Three classes of issues addressed:
--
-- A) search_path mutable on two trigger functions created after migration 12
--    (which only patched functions that existed at the time).
--
-- B) All SECURITY DEFINER functions in the public schema are callable by the
--    `anon` role by default (PostgreSQL grants EXECUTE to PUBLIC on new functions).
--    None of them should be reachable without authentication.
--
-- C) Several SECURITY DEFINER functions are trigger-only or admin-only and
--    should not be directly callable by signed-in users either. These are safe
--    to revoke because PostgreSQL trigger machinery invokes functions as the
--    function owner regardless of the caller's EXECUTE privilege.
--
-- Functions intentionally left executable by `authenticated`:
--   check_application_rate_limit()   -- user quota guard
--   get_user_application_count()     -- user stats
--   get_user_application_stats()     -- user stats
--   user_owns_application(uuid)      -- ownership helper used in policies
--   user_owns_application(text)      -- storage RLS policy dependency (MUST keep)

-- ── A: Fix mutable search_path ───────────────────────────────────────────────

-- Defined in migration 23 (fulltext_search), after migration 12 had already run.
ALTER FUNCTION public.update_job_applications_search_vector()
    SET search_path = '';

-- Defined in migration 24 (developer_identity), after migration 12 had already run.
ALTER FUNCTION public.set_updated_at()
    SET search_path = '';

-- ── B: Revoke anon EXECUTE from all flagged SECURITY DEFINER functions ────────

REVOKE EXECUTE ON FUNCTION public.check_application_rate_limit()    FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_otps()            FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_orphaned_files()          FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_default_email_templates()  FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_application_count()      FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_application_stats()      FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_application_activity()        FROM anon;
REVOKE EXECUTE ON FUNCTION public.schedule_document_purge()         FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_subscriptions_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_owns_application(uuid)       FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_owns_application(text)       FROM anon;

-- ── C: Revoke authenticated EXECUTE from trigger-only / admin-only functions ──

-- Trigger functions: called exclusively by the DB trigger engine as the function
-- owner. Revoking user EXECUTE does not affect trigger execution.
REVOKE EXECUTE ON FUNCTION public.log_application_activity()        FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.schedule_document_purge()         FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_subscriptions_updated_at() FROM authenticated;

-- Admin / cron functions: invoked only by Edge Functions running as service_role.
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_otps()            FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_orphaned_files()          FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.create_default_email_templates()  FROM authenticated;

-- ── D: rls_auto_enable — conditional (not created by our migrations) ──────────
-- This function is flagged by the linter but does not appear in any local
-- migration. It may be a Supabase internal or dashboard-created function.
-- The DO block revokes safely if the function exists; it is a no-op otherwise.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM   pg_proc   p
        JOIN   pg_namespace n ON n.oid = p.pronamespace
        WHERE  n.nspname  = 'public'
          AND  p.proname  = 'rls_auto_enable'
          AND  p.pronargs = 0
    ) THEN
        REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated;
    END IF;
END;
$$;
