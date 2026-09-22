-- OAuth public clients and short-lived authorization requests/codes for MCP.
-- OAuth client metadata is not a credential. Request IDs and codes are stored
-- only as SHA-256 hashes; only service-role backend code may access this data.
CREATE TABLE public.chatgpt_oauth_clients (
  client_id text PRIMARY KEY CHECK (client_id ~ '^jobnest_client_[a-f0-9]{32}$'),
  client_name text NOT NULL CHECK (length(client_name) BETWEEN 1 AND 100),
  redirect_uris text[] NOT NULL CHECK (cardinality(redirect_uris) BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.chatgpt_oauth_requests (
  request_hash text PRIMARY KEY CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  client_id text NOT NULL REFERENCES public.chatgpt_oauth_clients(client_id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  redirect_uri text NOT NULL CHECK (length(redirect_uri) BETWEEN 1 AND 2048),
  state text NOT NULL CHECK (length(state) BETWEEN 1 AND 1024),
  code_challenge text NOT NULL CHECK (code_challenge ~ '^[A-Za-z0-9_-]{43}$'),
  resource text NOT NULL CHECK (length(resource) BETWEEN 1 AND 2048),
  scope text NOT NULL CHECK (scope = 'applications:write'),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '10 minutes',
  decided_at timestamptz,
  code_hash text UNIQUE CHECK (code_hash ~ '^[a-f0-9]{64}$'),
  code_expires_at timestamptz,
  consumed_at timestamptz,
  CHECK (expires_at > created_at AND expires_at <= created_at + interval '11 minutes'),
  CHECK ((code_hash IS NULL AND code_expires_at IS NULL) OR
    (code_hash IS NOT NULL AND code_expires_at IS NOT NULL AND user_id IS NOT NULL AND decided_at IS NOT NULL)),
  CHECK (consumed_at IS NULL OR code_hash IS NOT NULL)
);

CREATE INDEX chatgpt_oauth_requests_user_idx ON public.chatgpt_oauth_requests(user_id);
CREATE INDEX chatgpt_oauth_requests_expiry_idx ON public.chatgpt_oauth_requests(expires_at);

ALTER TABLE public.chatgpt_oauth_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatgpt_oauth_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chatgpt_oauth_clients, public.chatgpt_oauth_requests FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.chatgpt_oauth_clients, public.chatgpt_oauth_requests TO service_role;

CREATE FUNCTION public.claim_chatgpt_oauth_request(p_request_hash text, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  oauth_request public.chatgpt_oauth_requests%ROWTYPE;
  client_name text;
BEGIN
  -- Account locks precede row locks everywhere, including disconnect/exchange.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('chatgpt:' || p_user_id::text, 0));
  IF NOT EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id = p_user_id
      AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until <= clock_timestamp())
  ) OR EXISTS (SELECT 1 FROM public.pending_deletions d WHERE d.user_id = p_user_id AND d.cancelled_at IS NULL)
  THEN RETURN NULL; END IF;

  SELECT r.* INTO oauth_request FROM public.chatgpt_oauth_requests r
    WHERE r.request_hash = p_request_hash FOR UPDATE;
  IF NOT FOUND OR oauth_request.expires_at <= clock_timestamp() OR oauth_request.decided_at IS NOT NULL
    OR (oauth_request.user_id IS NOT NULL AND oauth_request.user_id <> p_user_id)
  THEN RETURN NULL; END IF;

  SELECT c.client_name INTO client_name FROM public.chatgpt_oauth_clients c
    WHERE c.client_id = oauth_request.client_id AND oauth_request.redirect_uri = ANY(c.redirect_uris);
  IF NOT FOUND THEN RETURN NULL; END IF;
  UPDATE public.chatgpt_oauth_requests SET user_id = p_user_id WHERE request_hash = p_request_hash;
  RETURN jsonb_build_object('client_name', client_name, 'redirect_uri', oauth_request.redirect_uri,
    'expires_at', oauth_request.expires_at);
END;
$$;

CREATE FUNCTION public.complete_chatgpt_oauth_consent(p_request_hash text, p_user_id uuid, p_code_hash text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  oauth_request public.chatgpt_oauth_requests%ROWTYPE;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('chatgpt:' || p_user_id::text, 0));
  IF NOT EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id = p_user_id
      AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until <= clock_timestamp())
  ) OR EXISTS (SELECT 1 FROM public.pending_deletions d WHERE d.user_id = p_user_id AND d.cancelled_at IS NULL)
  THEN RETURN NULL; END IF;
  IF p_code_hash IS NOT NULL AND p_code_hash !~ '^[a-f0-9]{64}$' THEN RETURN NULL; END IF;

  SELECT r.* INTO oauth_request FROM public.chatgpt_oauth_requests r
    WHERE r.request_hash = p_request_hash FOR UPDATE;
  -- A signed-in GET of the consent screen must first claim this request. A
  -- cookie-authenticated POST cannot substitute a different Jobnest account.
  IF NOT FOUND OR oauth_request.user_id IS DISTINCT FROM p_user_id
    OR oauth_request.expires_at <= clock_timestamp() OR oauth_request.decided_at IS NOT NULL
  THEN RETURN NULL; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.chatgpt_oauth_clients c WHERE c.client_id = oauth_request.client_id
      AND oauth_request.redirect_uri = ANY(c.redirect_uris)
  ) THEN RETURN NULL; END IF;

  UPDATE public.chatgpt_oauth_requests SET
    decided_at = clock_timestamp(), code_hash = p_code_hash,
    code_expires_at = CASE WHEN p_code_hash IS NULL THEN NULL ELSE clock_timestamp() + interval '5 minutes' END
    WHERE request_hash = p_request_hash;
  RETURN jsonb_build_object('redirect_uri', oauth_request.redirect_uri, 'state', oauth_request.state);
END;
$$;

CREATE FUNCTION public.exchange_chatgpt_oauth_code(
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
  -- The unlocked lookup only chooses the account lock. Authorization happens
  -- again after taking that lock and the code row lock, defeating concurrent replay.
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
    OR oauth_request.scope <> 'applications:write'
    OR oauth_request.code_challenge IS DISTINCT FROM p_code_challenge
  THEN RETURN NULL; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.chatgpt_oauth_clients c WHERE c.client_id = p_client_id AND p_redirect_uri = ANY(c.redirect_uris)
  ) OR NOT EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id = owner_id
      AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until <= clock_timestamp())
  ) OR EXISTS (SELECT 1 FROM public.pending_deletions d WHERE d.user_id = owner_id AND d.cancelled_at IS NULL)
  THEN RETURN NULL; END IF;

  -- Consumption and rotation commit together. A failed rotation rolls back
  -- consumption; a successful concurrent request can never redeem this code again.
  UPDATE public.chatgpt_oauth_requests SET consumed_at = clock_timestamp()
    WHERE request_hash = oauth_request.request_hash;
  credential := public.rotate_chatgpt_credential(owner_id, p_key_hash, p_key_prefix, p_resource);
  RETURN credential;
END;
$$;

-- Disconnect invalidates approved-but-unredeemed codes and outstanding consent
-- requests too, so an in-flight exchange cannot resurrect a disconnected link.
CREATE OR REPLACE FUNCTION public.revoke_chatgpt_credential(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('chatgpt:' || p_user_id::text, 0));
  DELETE FROM public.chatgpt_credentials WHERE user_id = p_user_id;
  DELETE FROM public.chatgpt_oauth_requests WHERE user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_chatgpt_oauth_request(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_chatgpt_oauth_consent(text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.exchange_chatgpt_oauth_code(text, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_chatgpt_credential(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_chatgpt_oauth_request(text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_chatgpt_oauth_consent(text, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.exchange_chatgpt_oauth_code(text, text, text, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_chatgpt_credential(uuid) TO service_role;
