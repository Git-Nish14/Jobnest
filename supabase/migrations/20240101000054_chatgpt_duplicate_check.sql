-- Add a narrowly scoped duplicate check before users apply. Reading whether a
-- matching private record exists is a new permission, so existing connections
-- are revoked and users must explicitly reconnect with read + write scopes.

DELETE FROM public.chatgpt_oauth_requests;
DELETE FROM public.chatgpt_credentials;

ALTER TABLE public.chatgpt_credentials
  DROP CONSTRAINT chatgpt_credentials_scope_check;
ALTER TABLE public.chatgpt_credentials
  ALTER COLUMN scope SET DEFAULT 'applications:read applications:write';
ALTER TABLE public.chatgpt_credentials
  ADD CONSTRAINT chatgpt_credentials_scope_check
  CHECK (scope = 'applications:read applications:write');

ALTER TABLE public.chatgpt_oauth_requests
  DROP CONSTRAINT chatgpt_oauth_requests_scope_check;
ALTER TABLE public.chatgpt_oauth_requests
  ADD CONSTRAINT chatgpt_oauth_requests_scope_check
  CHECK (scope = 'applications:read applications:write');

-- Replaces the privileged transactional save function without changing its signature.

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

CREATE OR REPLACE FUNCTION public.exchange_chatgpt_oauth_code(
  p_code_hash text, p_client_id text, p_redirect_uri text, p_resource text,
  p_code_challenge text, p_key_hash text, p_key_prefix text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  owner_id uuid;
  oauth_request public.chatgpt_oauth_requests%ROWTYPE;
  credential jsonb;
BEGIN
  SELECT r.user_id INTO owner_id FROM public.chatgpt_oauth_requests r WHERE r.code_hash = p_code_hash;
  IF NOT FOUND OR owner_id IS NULL THEN RETURN NULL; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('chatgpt:' || owner_id::text, 0));
  SELECT r.* INTO oauth_request FROM public.chatgpt_oauth_requests r
    WHERE r.code_hash = p_code_hash AND r.user_id = owner_id FOR UPDATE;
  IF NOT FOUND OR oauth_request.decided_at IS NULL OR oauth_request.consumed_at IS NOT NULL
    OR oauth_request.code_expires_at IS NULL OR oauth_request.code_expires_at <= clock_timestamp()
    OR oauth_request.client_id IS DISTINCT FROM p_client_id
    OR oauth_request.redirect_uri IS DISTINCT FROM p_redirect_uri
    OR oauth_request.resource IS DISTINCT FROM p_resource
    OR oauth_request.scope <> 'applications:read applications:write'
    OR oauth_request.code_challenge IS DISTINCT FROM p_code_challenge
  THEN RETURN NULL; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.chatgpt_oauth_clients c WHERE c.client_id = p_client_id AND p_redirect_uri = ANY(c.redirect_uris)
  ) OR NOT EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id = owner_id
      AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until <= clock_timestamp())
  ) OR EXISTS (SELECT 1 FROM public.pending_deletions d WHERE d.user_id = owner_id AND d.cancelled_at IS NULL)
  THEN RETURN NULL; END IF;

  UPDATE public.chatgpt_oauth_requests SET consumed_at = clock_timestamp()
    WHERE request_hash = oauth_request.request_hash;
  credential := public.rotate_chatgpt_credential(owner_id, p_key_hash, p_key_prefix, p_resource);
  RETURN credential;
END;
$$;

CREATE FUNCTION public.check_chatgpt_application_duplicate(
  p_key_hash text,
  p_resource text,
  p_company text,
  p_position text,
  p_location text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  owner_id uuid;
  credential public.chatgpt_credentials%ROWTYPE;
  application public.job_applications%ROWTYPE;
BEGIN
  IF p_company IS NULL OR length(btrim(p_company)) NOT BETWEEN 1 AND 255
    OR p_position IS NULL OR length(btrim(p_position)) NOT BETWEEN 1 AND 255
    OR p_location IS NULL OR length(btrim(p_location)) NOT BETWEEN 1 AND 255
  THEN RETURN jsonb_build_object('error', 'invalid_query'); END IF;

  SELECT c.user_id INTO owner_id FROM public.chatgpt_credentials c WHERE c.key_hash = p_key_hash;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'invalid_key'); END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('chatgpt:' || owner_id::text, 0));
  SELECT c.* INTO credential FROM public.chatgpt_credentials c
    WHERE c.key_hash = p_key_hash AND c.user_id = owner_id;
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

  SELECT a.* INTO application
  FROM public.job_applications a
  WHERE a.user_id = owner_id
    AND lower(pg_catalog.regexp_replace(btrim(a.company), '[^[:alnum:]]+', '', 'g')) =
      lower(pg_catalog.regexp_replace(btrim(p_company), '[^[:alnum:]]+', '', 'g'))
    AND lower(pg_catalog.regexp_replace(btrim(a.position), '[^[:alnum:]]+', '', 'g')) =
      lower(pg_catalog.regexp_replace(btrim(p_position), '[^[:alnum:]]+', '', 'g'))
    AND lower(pg_catalog.regexp_replace(btrim(coalesce(a.location, '')), '[^[:alnum:]]+', '', 'g')) =
      lower(pg_catalog.regexp_replace(btrim(p_location), '[^[:alnum:]]+', '', 'g'))
  ORDER BY a.applied_date DESC, a.created_at DESC, a.id
  LIMIT 1;

  IF NOT FOUND THEN RETURN jsonb_build_object('match', false); END IF;
  RETURN jsonb_build_object(
    'match', true,
    'application', jsonb_build_object(
      'id', application.id,
      'company', application.company,
      'position', application.position,
      'location', application.location,
      'status', application.status,
      'applied_date', application.applied_date,
      'job_url', application.job_url
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_chatgpt_application_duplicate(text, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_chatgpt_application_duplicate(text, text, text, text, text)
  TO service_role;
