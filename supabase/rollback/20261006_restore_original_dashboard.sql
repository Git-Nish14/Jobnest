-- Restore compatibility with Jobnest commit 3e730f9 (the original dashboard).
-- Run this complete file in Supabase SQL Editor as the project database owner.
-- If migrations 055-058 were never applied, no database rollback is needed.
--
-- This script backs up affected rows in a private, API-inaccessible schema.
-- Saved/Preparing -> Withdrawn (never falsely marks bookmarks as submitted).
-- Accepted -> Offer (preserves the offer in the old supported lifecycle).
-- Original status and extra fields remain recoverable in the private backup.
-- Existing applications, documents, activity history, weekly_goal and ChatGPT
-- connections are kept. New planner/checklist tables are backed up before removal.
-- Unused enum labels stay in place: PostgreSQL cannot remove them without a
-- dependent-type rebuild, which is unnecessary for the old app to work.
-- Reference: https://www.postgresql.org/docs/current/datatype-enum.html
-- Cancelled/retained purge entries stay retained: migration 056 did not record
-- which were auto-retained versus manually retained, so that change is not guessed.
-- The original 30-day rule is restored for FUTURE rejection status changes.
-- This does not reconstruct any application dates edited since the old release.

BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('jobnest:restore-original-dashboard', 0));

DO $preflight$
BEGIN
  IF to_regclass('public.job_applications') IS NULL OR to_regclass('public.activity_logs') IS NULL
    OR to_regclass('public.document_purge_queue') IS NULL THEN
    RAISE EXCEPTION 'Required original Jobnest tables are missing. No changes have been committed.';
  END IF;
END;
$preflight$;

CREATE SCHEMA IF NOT EXISTS jobnest_rollback_backup;
REVOKE ALL ON SCHEMA jobnest_rollback_backup FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS jobnest_rollback_backup.dashboard_20261006 (
  category text NOT NULL,
  record_key text NOT NULL,
  original_row jsonb NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(category, record_key)
);
REVOKE ALL ON ALL TABLES IN SCHEMA jobnest_rollback_backup FROM PUBLIC, anon, authenticated;

-- Save only records affected by the new statuses/columns, before changing them.
INSERT INTO jobnest_rollback_backup.dashboard_20261006(category, record_key, original_row)
SELECT 'application', a.id::text, to_jsonb(a)
FROM public.job_applications a
WHERE a.status::text IN ('Saved', 'Preparing', 'Accepted')
  OR to_jsonb(a)->>'saved_date' IS NOT NULL
  OR to_jsonb(a)->>'submitted_at' IS NOT NULL
ON CONFLICT(category, record_key) DO NOTHING;

DO $backup$
BEGIN
  IF to_regclass('public.search_plan_tasks') IS NOT NULL THEN
    INSERT INTO jobnest_rollback_backup.dashboard_20261006(category, record_key, original_row)
    SELECT 'plan_task', user_id::text || '/' || week_start::text || '/' || task_key, to_jsonb(t)
    FROM public.search_plan_tasks t ON CONFLICT(category, record_key) DO NOTHING;
  END IF;
  IF to_regclass('public.application_tailoring_checklists') IS NOT NULL THEN
    INSERT INTO jobnest_rollback_backup.dashboard_20261006(category, record_key, original_row)
    SELECT 'tailoring_checklist', application_id::text, to_jsonb(c)
    FROM public.application_tailoring_checklists c ON CONFLICT(category, record_key) DO NOTHING;
  END IF;
END;
$backup$;

INSERT INTO jobnest_rollback_backup.dashboard_20261006(category, record_key, original_row)
SELECT 'search_preferences', u.id::text,
  jsonb_build_object('user_id', u.id, 'search_preferences', u.raw_user_meta_data->'search_preferences')
FROM auth.users u WHERE u.raw_user_meta_data ? 'search_preferences'
ON CONFLICT(category, record_key) DO NOTHING;
UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data - 'search_preferences'
WHERE raw_user_meta_data ? 'search_preferences';

-- Disable submission-date rewriting before any status conversion.
DROP TRIGGER IF EXISTS capture_submission_date ON public.job_applications;
DROP FUNCTION IF EXISTS public.capture_submission_date();

CREATE OR REPLACE FUNCTION log_application_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO activity_logs (user_id, application_id, activity_type, description, metadata)
        VALUES (
            NEW.user_id,
            NEW.id,
            'Created',
            'Application created for ' || NEW.position || ' at ' || NEW.company,
            '{}'
        );
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            INSERT INTO activity_logs (user_id, application_id, activity_type, description, metadata)
            VALUES (
                NEW.user_id,
                NEW.id,
                'Status Changed',
                'Status changed from ' || OLD.status || ' to ' || NEW.status,
                jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status)
            );
        ELSE
            INSERT INTO activity_logs (user_id, application_id, activity_type, description, metadata)
            VALUES (
                NEW.user_id,
                NEW.id,
                'Updated',
                'Application details updated',
                '{}'
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS application_activity_trigger ON job_applications;
CREATE TRIGGER application_activity_trigger
    AFTER INSERT OR UPDATE ON job_applications
    FOR EACH ROW
    EXECUTE FUNCTION log_application_activity();


REVOKE EXECUTE ON FUNCTION public.log_application_activity() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION schedule_document_purge()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.status = 'Rejected' AND (OLD.status IS DISTINCT FROM 'Rejected') THEN
        INSERT INTO document_purge_queue (application_id, user_id, purge_at)
        VALUES (NEW.id, NEW.user_id, NOW() + INTERVAL '30 days')
        ON CONFLICT (application_id) DO NOTHING;
        -- ON CONFLICT: if an entry already exists (e.g. re-rejected after retain),
        -- do not reset the original purge timer.
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_schedule_document_purge ON job_applications;

CREATE TRIGGER trg_schedule_document_purge
    AFTER UPDATE ON job_applications
    FOR EACH ROW
    EXECUTE FUNCTION schedule_document_purge();


REVOKE EXECUTE ON FUNCTION public.schedule_document_purge() FROM PUBLIC, anon, authenticated;

-- Keep every role and history entry; adapt only unsupported CURRENT statuses.
UPDATE public.job_applications
SET status = CASE WHEN status::text = 'Accepted' THEN 'Offer'::public.application_status
                  ELSE 'Withdrawn'::public.application_status END
WHERE status::text IN ('Saved', 'Preparing', 'Accepted');

-- Restore the old ChatGPT save validator only. Never rerun all of migration 054:
-- its connection-revocation statements are intentionally excluded here.
DO $restore_plugin$
BEGIN
  IF to_regclass('public.chatgpt_credentials') IS NOT NULL
    AND to_regclass('public.chatgpt_application_requests') IS NOT NULL THEN
    EXECUTE $original_save$
CREATE OR REPLACE FUNCTION public.save_chatgpt_application(
  p_key_hash text,
  p_resource text,
  p_request_id text,
  p_content_hash text,
  p_application jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  owner_id uuid;
  credential public.chatgpt_credentials%ROWTYPE;
  previous_request public.chatgpt_application_requests%ROWTYPE;
  application public.job_applications%ROWTYPE;
  is_duplicate boolean := false;
  applied_date date;
BEGIN
  -- This first lookup only chooses the lock; it does not authorize the write.
  SELECT c.user_id INTO owner_id FROM public.chatgpt_credentials c WHERE c.key_hash = p_key_hash;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'invalid_key'); END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('chatgpt:' || owner_id::text, 0));
  SELECT c.* INTO credential FROM public.chatgpt_credentials c
    WHERE c.key_hash = p_key_hash AND c.user_id = owner_id FOR UPDATE;
  IF NOT FOUND OR credential.expires_at <= clock_timestamp()
    OR credential.resource IS DISTINCT FROM p_resource
    OR credential.scope <> 'applications:read applications:write' THEN
    RETURN jsonb_build_object('error', 'invalid_key');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id = owner_id
      AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until <= now())
  ) OR EXISTS (
    SELECT 1 FROM public.pending_deletions d
      WHERE d.user_id = owner_id AND d.cancelled_at IS NULL AND d.deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('error', 'invalid_key');
  END IF;

  -- A database limit remains effective across serverless instances, even when
  -- the optional Redis limiter is unavailable. Retries count toward the limit.
  IF credential.rate_window_started_at <= clock_timestamp() - interval '1 minute' THEN
    UPDATE public.chatgpt_credentials SET rate_window_started_at = clock_timestamp(), rate_window_count = 1
      WHERE id = credential.id;
  ELSIF credential.rate_window_count >= 60 THEN
    RETURN jsonb_build_object('error', 'rate_limited');
  ELSE
    UPDATE public.chatgpt_credentials SET rate_window_count = rate_window_count + 1 WHERE id = credential.id;
  END IF;

  -- Reject unexpected fields and types before casts. Service code also validates
  -- the JSON schema, but future privileged callers must preserve these boundaries.
  IF jsonb_typeof(p_application) IS DISTINCT FROM 'object' THEN
    RETURN jsonb_build_object('error', 'invalid_application');
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_each(p_application) e
      WHERE e.key NOT IN ('company', 'position', 'applied_date', 'status', 'job_id', 'job_url',
        'salary_range', 'location', 'notes', 'job_description', 'source', 'ats_provider',
        'requires_sponsorship', 'company_tier', 'glassdoor_rating')
        OR (e.key IN ('company', 'position', 'applied_date', 'status', 'job_id', 'job_url',
          'salary_range', 'location', 'notes', 'job_description', 'source', 'ats_provider',
          'company_tier') AND jsonb_typeof(e.value) <> 'string')
        OR (e.key = 'requires_sponsorship' AND jsonb_typeof(e.value) <> 'boolean')
        OR (e.key = 'glassdoor_rating' AND jsonb_typeof(e.value) <> 'number')
  ) OR p_request_id IS NULL OR length(btrim(p_request_id)) NOT BETWEEN 1 AND 100
    OR p_content_hash IS NULL OR p_content_hash !~ '^[a-f0-9]{64}$'
    OR nullif(btrim(p_application ->> 'company'), '') IS NULL
    OR nullif(btrim(p_application ->> 'position'), '') IS NULL
    OR nullif(p_application ->> 'applied_date', '') IS NULL
    OR length(p_application ->> 'company') > 255
    OR length(p_application ->> 'position') > 255
    OR length(p_application ->> 'job_id') > 100
    OR length(p_application ->> 'job_url') > 2083
    OR (p_application ? 'job_url' AND p_application ->> 'job_url' !~* '^https?://[^[:space:]]+$')
    OR length(p_application ->> 'salary_range') > 100
    OR length(p_application ->> 'location') > 255
    OR length(p_application ->> 'notes') > 5000
    OR length(p_application ->> 'job_description') > 20000
    OR (p_application ? 'status' AND p_application ->> 'status' NOT IN (
      'Applied', 'Phone Screen', 'Interview', 'Offer', 'Rejected', 'Withdrawn', 'Ghosted'))
    OR (p_application ? 'source' AND p_application ->> 'source' NOT IN (
      'LinkedIn', 'LinkedIn Easy Apply', 'Indeed', 'Company Website', 'Referral', 'Recruiter Outreach',
      'Handshake', 'Wellfound', 'Dice', 'Job Fair', 'Other'))
    OR (p_application ? 'ats_provider' AND p_application ->> 'ats_provider' NOT IN (
      'Workday', 'Lever', 'Greenhouse', 'Ashby', 'Oracle (Taleo)', 'SAP SuccessFactors', 'iCIMS',
      'Jobvite', 'SmartRecruiters', 'BambooHR', 'Rippling', 'ADP', 'Paylocity', 'Paycor', 'UKG Pro',
      'Workable', 'JazzHR', 'Breezy HR', 'Bullhorn', 'Cornerstone OnDemand', 'HireVue', 'Freshteam',
      'Zoho Recruit', 'Recruiting.com', 'Company Website Portal', 'Other'))
    OR (p_application ? 'company_tier' AND p_application ->> 'company_tier' NOT IN (
      'FAANG', 'Tier 1', 'Tier 2', 'Tier 3', 'Startup'))
    OR (CASE WHEN p_application ? 'glassdoor_rating'
      AND jsonb_typeof(p_application -> 'glassdoor_rating') = 'number'
      THEN ((p_application ->> 'glassdoor_rating')::numeric NOT BETWEEN 1.0 AND 5.0
        OR (p_application ->> 'glassdoor_rating')::numeric <> round((p_application ->> 'glassdoor_rating')::numeric, 1))
      ELSE false END)
    OR p_application ->> 'applied_date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  THEN
    RETURN jsonb_build_object('error', 'invalid_application');
  END IF;
  BEGIN
    applied_date := (p_application ->> 'applied_date')::date;
  EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
    RETURN jsonb_build_object('error', 'invalid_application');
  END;

  SELECT r.* INTO previous_request FROM public.chatgpt_application_requests r
    WHERE r.user_id = owner_id AND r.request_id = p_request_id;
  IF FOUND THEN
    IF previous_request.content_hash <> p_content_hash THEN
      RETURN jsonb_build_object('error', 'request_conflict');
    END IF;
    SELECT a.* INTO application FROM public.job_applications a
      WHERE a.id = previous_request.application_id AND a.user_id = owner_id FOR KEY SHARE;
    IF NOT FOUND THEN RETURN jsonb_build_object('error', 'application_deleted'); END IF;
    is_duplicate := true;
  ELSE
    -- A model may generate a new ID after a lost response. Only an identical
    -- previous plugin payload may match: company/title/day alone could conflate
    -- distinct requisitions or silently discard changed notes and status.
    SELECT a.* INTO application FROM public.job_applications a
      JOIN public.chatgpt_application_requests r ON r.application_id = a.id
      WHERE a.user_id = owner_id AND r.user_id = owner_id AND r.content_hash = p_content_hash
      ORDER BY r.created_at, a.id LIMIT 1 FOR KEY SHARE OF a;
    is_duplicate := FOUND;

    IF NOT is_duplicate THEN
      INSERT INTO public.job_applications (
        user_id, company, position, status, applied_date, job_id, job_url,
        salary_range, location, notes, job_description, source, ats_provider,
        requires_sponsorship, company_tier, glassdoor_rating
      ) VALUES (
        owner_id,
        p_application ->> 'company',
        p_application ->> 'position',
        coalesce(p_application ->> 'status', 'Applied')::public.application_status,
        applied_date,
        nullif(p_application ->> 'job_id', ''),
        nullif(p_application ->> 'job_url', ''),
        nullif(p_application ->> 'salary_range', ''),
        nullif(p_application ->> 'location', ''),
        nullif(p_application ->> 'notes', ''),
        nullif(p_application ->> 'job_description', ''),
        nullif(p_application ->> 'source', ''),
        nullif(p_application ->> 'ats_provider', ''),
        coalesce((p_application ->> 'requires_sponsorship')::boolean, false),
        nullif(p_application ->> 'company_tier', '')::public.company_tier,
        (p_application ->> 'glassdoor_rating')::numeric
      ) RETURNING * INTO application;
    END IF;

    INSERT INTO public.chatgpt_application_requests (user_id, request_id, content_hash, application_id)
      VALUES (owner_id, p_request_id, p_content_hash, application.id);
  END IF;

  UPDATE public.chatgpt_credentials SET last_used_at = clock_timestamp() WHERE id = credential.id;
  RETURN jsonb_build_object(
    'duplicate', is_duplicate,
    'application', jsonb_build_object(
      'id', application.id,
      'company', application.company,
      'position', application.position,
      'status', application.status,
      'applied_date', application.applied_date,
      'job_id', application.job_id,
      'job_url', application.job_url,
      'salary_range', application.salary_range,
      'location', application.location,
      'notes', application.notes,
      'job_description', application.job_description,
      'source', application.source,
      'ats_provider', application.ats_provider,
      'requires_sponsorship', application.requires_sponsorship,
      'company_tier', application.company_tier,
      'glassdoor_rating', application.glassdoor_rating
    )
  );
END;
$$;
$original_save$;
  END IF;
END;
$restore_plugin$;

-- Remove only additions from the cancelled work, after their data is backed up.
DROP FUNCTION IF EXISTS public.save_tailoring_checklist(uuid, integer, text, jsonb);
DROP TABLE IF EXISTS public.application_tailoring_checklists;
DROP TABLE IF EXISTS public.search_plan_tasks;
ALTER TABLE public.job_applications DROP COLUMN IF EXISTS saved_date;
ALTER TABLE public.job_applications DROP COLUMN IF EXISTS submitted_at;

-- If these migrations were applied through the CLI, align its history as well.
DO $history$
BEGIN
  IF to_regclass('supabase_migrations.schema_migrations') IS NOT NULL THEN
    INSERT INTO jobnest_rollback_backup.dashboard_20261006(category, record_key, original_row)
    SELECT 'migration', version::text, to_jsonb(m)
    FROM supabase_migrations.schema_migrations m
    WHERE version::text IN ('20240101000055', '20240101000056', '20240101000057', '20240101000058')
    ON CONFLICT(category, record_key) DO NOTHING;
    DELETE FROM supabase_migrations.schema_migrations
    WHERE version::text IN ('20240101000055', '20240101000056', '20240101000057', '20240101000058');
  END IF;
END;
$history$;

NOTIFY pgrst, 'reload schema';
COMMIT;

-- Verification: expected result is zero for both counts.
SELECT
  (SELECT count(*) FROM public.job_applications WHERE status::text IN ('Saved', 'Preparing', 'Accepted')) AS unsupported_current_statuses,
  (SELECT count(*) FROM pg_trigger WHERE tgrelid = 'public.job_applications'::regclass AND tgname = 'capture_submission_date') AS new_submission_triggers;
