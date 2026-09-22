-- ChatGPT/MCP connection tokens are opaque, scoped to saving applications, and
-- never stored in plaintext. Only server-side service-role code can use these
-- tables/functions; browser clients cannot mint or inspect another user's token.
CREATE TABLE public.chatgpt_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  key_hash text NOT NULL UNIQUE CHECK (key_hash ~ '^[a-f0-9]{64}$'),
  key_prefix text NOT NULL CHECK (key_prefix ~ '^jobnest_[a-f0-9]{7}$'),
  resource text NOT NULL CHECK (resource ~ '^https://'),
  scope text NOT NULL DEFAULT 'applications:write' CHECK (scope = 'applications:write'),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '365 days',
  rate_window_started_at timestamptz NOT NULL DEFAULT now(),
  rate_window_count integer NOT NULL DEFAULT 0 CHECK (rate_window_count >= 0)
);

CREATE TABLE public.chatgpt_application_requests (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id text NOT NULL CHECK (length(request_id) BETWEEN 1 AND 100),
  content_hash text NOT NULL CHECK (content_hash ~ '^[a-f0-9]{64}$'),
  -- Keep a tombstone when a user deletes an application. Retrying an old
  -- request must not silently recreate something the user deliberately deleted.
  application_id uuid REFERENCES public.job_applications(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, request_id)
);

CREATE INDEX chatgpt_application_requests_application_idx
  ON public.chatgpt_application_requests(application_id) WHERE application_id IS NOT NULL;
CREATE INDEX chatgpt_application_requests_content_idx
  ON public.chatgpt_application_requests(user_id, content_hash) WHERE application_id IS NOT NULL;

ALTER TABLE public.chatgpt_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatgpt_application_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chatgpt_credentials, public.chatgpt_application_requests FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.chatgpt_credentials, public.chatgpt_application_requests TO service_role;

CREATE FUNCTION public.rotate_chatgpt_credential(p_user_id uuid, p_key_hash text, p_key_prefix text, p_resource text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  credential public.chatgpt_credentials%ROWTYPE;
BEGIN
  -- All token rotation, disconnection and saves acquire this lock first. A
  -- request authenticated before disconnection is rechecked after the lock.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('chatgpt:' || p_user_id::text, 0));
  IF NOT EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id = p_user_id
      AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until <= now())
  ) OR EXISTS (
    SELECT 1 FROM public.pending_deletions d
      WHERE d.user_id = p_user_id AND d.cancelled_at IS NULL AND d.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Account is unavailable' USING ERRCODE = '28000';
  END IF;

  DELETE FROM public.chatgpt_credentials WHERE user_id = p_user_id;
  INSERT INTO public.chatgpt_credentials (user_id, key_hash, key_prefix, resource)
    VALUES (p_user_id, p_key_hash, p_key_prefix, p_resource)
    RETURNING * INTO credential;
  RETURN jsonb_build_object(
    'id', credential.id,
    'key_prefix', credential.key_prefix,
    'created_at', credential.created_at,
    'last_used_at', credential.last_used_at,
    'expires_at', credential.expires_at
  );
END;
$$;

CREATE FUNCTION public.revoke_chatgpt_credential(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('chatgpt:' || p_user_id::text, 0));
  DELETE FROM public.chatgpt_credentials WHERE user_id = p_user_id;
END;
$$;

CREATE FUNCTION public.save_chatgpt_application(
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
    OR credential.resource IS DISTINCT FROM p_resource OR credential.scope <> 'applications:write' THEN
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
        'salary_range', 'location', 'notes', 'job_description', 'source')
        OR jsonb_typeof(e.value) <> 'string'
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
        salary_range, location, notes, job_description, source
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
        nullif(p_application ->> 'source', '')
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
      'applied_date', application.applied_date
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rotate_chatgpt_credential(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_chatgpt_credential(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_chatgpt_application(text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rotate_chatgpt_credential(uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_chatgpt_credential(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.save_chatgpt_application(text, text, text, text, jsonb) TO service_role;
