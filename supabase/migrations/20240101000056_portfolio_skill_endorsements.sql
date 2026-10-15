-- Anonymous endorsements are accessible only through the server's guarded API.
CREATE TABLE public.portfolio_skill_endorsements (
  skill_id uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  visitor_hash text NOT NULL CHECK (visitor_hash ~ '^[a-f0-9]{64}$'),
  network_hash text NOT NULL CHECK (network_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (skill_id, visitor_hash),
  UNIQUE (skill_id, network_hash)
);
CREATE INDEX portfolio_endorsement_network_recent
  ON public.portfolio_skill_endorsements (network_hash, created_at);
ALTER TABLE public.portfolio_skill_endorsements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_skill_endorsements FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.portfolio_skill_endorsements FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.portfolio_skill_endorsements TO service_role;

CREATE FUNCTION public.get_public_skill_endorsements(p_user_id uuid, p_visitor_hash text, p_network_hash text)
RETURNS TABLE(skill_id uuid, endorsement_count bigint, endorsed boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT s.id, count(e.skill_id), coalesce(bool_or(e.visitor_hash = p_visitor_hash OR e.network_hash = p_network_hash), false)
  FROM public.skills s
  JOIN auth.users u ON u.id = s.user_id AND u.raw_user_meta_data->'portfolio_public' = 'true'::jsonb
  LEFT JOIN public.portfolio_skill_endorsements e ON e.skill_id = s.id
  WHERE s.user_id = p_user_id
  GROUP BY s.id;
$$;
REVOKE ALL ON FUNCTION public.get_public_skill_endorsements(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_skill_endorsements(uuid, text, text) TO service_role;

CREATE FUNCTION public.endorse_public_skill(p_user_id uuid, p_skill_id uuid, p_visitor_hash text, p_network_hash text)
RETURNS TABLE(skill_id uuid, endorsement_count bigint, endorsed boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_visitor_hash !~ '^[a-f0-9]{64}$' OR p_network_hash !~ '^[a-f0-9]{64}$'
    OR p_visitor_hash IS NULL OR p_network_hash IS NULL THEN
    RAISE EXCEPTION 'invalid_endorsement_identity';
  END IF;
  -- Serialize writes per network across instances, including parallel requests.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_network_hash, 0));
  -- Lock the publication/ownership rows through insertion to prevent a visibility race.
  PERFORM s.id FROM public.skills s JOIN auth.users u ON u.id = s.user_id
    WHERE s.id = p_skill_id AND s.user_id = p_user_id
      AND u.raw_user_meta_data->'portfolio_public' = 'true'::jsonb FOR SHARE OF s, u;
  IF NOT FOUND THEN RAISE EXCEPTION 'endorsement_skill_not_found'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.portfolio_skill_endorsements e
    WHERE e.skill_id = p_skill_id AND (e.visitor_hash = p_visitor_hash OR e.network_hash = p_network_hash)) THEN
    IF (SELECT count(*) FROM public.portfolio_skill_endorsements e
      WHERE e.network_hash = p_network_hash AND e.created_at > now() - interval '24 hours') >= 20 THEN
      RAISE EXCEPTION 'endorsement_daily_limit';
    END IF;
    INSERT INTO public.portfolio_skill_endorsements(skill_id, visitor_hash, network_hash)
      VALUES(p_skill_id, p_visitor_hash, p_network_hash) ON CONFLICT DO NOTHING;
  END IF;
  RETURN QUERY SELECT * FROM public.get_public_skill_endorsements(p_user_id, p_visitor_hash, p_network_hash)
    WHERE get_public_skill_endorsements.skill_id = p_skill_id;
END;
$$;
REVOKE ALL ON FUNCTION public.endorse_public_skill(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.endorse_public_skill(uuid, uuid, text, text) TO service_role;
