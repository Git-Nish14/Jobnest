-- Migration: Fix mutable search_path on all functions
-- Description: Sets search_path = '' on every function to prevent search_path injection attacks.
--              Without this, a malicious user could manipulate search_path to redirect
--              function calls to a schema they control.

ALTER FUNCTION public.update_updated_at_column()
  SET search_path = '';

ALTER FUNCTION public.user_owns_application(UUID)
  SET search_path = '';

ALTER FUNCTION public.get_user_application_count()
  SET search_path = '';

ALTER FUNCTION public.get_user_application_stats()
  SET search_path = '';

ALTER FUNCTION public.check_application_rate_limit()
  SET search_path = '';

ALTER FUNCTION public.cleanup_orphaned_files()
  SET search_path = '';

ALTER FUNCTION public.log_application_activity()
  SET search_path = '';

ALTER FUNCTION public.create_default_email_templates()
  SET search_path = '';

ALTER FUNCTION public.cleanup_expired_otps()
  SET search_path = '';

ALTER FUNCTION public.update_subscriptions_updated_at()
  SET search_path = '';

ALTER FUNCTION public.handle_updated_at()
  SET search_path = '';
