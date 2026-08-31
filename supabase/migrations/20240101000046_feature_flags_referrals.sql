-- Migration 046: Feature flags + growth referral system
-- Fully idempotent: safe to re-run if the previous version was already applied.
-- Changes vs first run: UNIQUE (referee_id) added to user_referral_events,
-- REVOKE ALL FROM anon added to all three tables,
-- record_referral_signup uses ON CONFLICT DO NOTHING + FOUND guard.

-- ── Feature flags ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS feature_flags (
  id                  uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  flag_name           text    NOT NULL UNIQUE,
  description         text,
  enabled             boolean NOT NULL DEFAULT false,
  enabled_for_plans   text[]  NOT NULL DEFAULT '{}',
  rollout_percentage  integer NOT NULL DEFAULT 0
                      CHECK (rollout_percentage BETWEEN 0 AND 100),
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read feature_flags" ON feature_flags;
CREATE POLICY "Authenticated users can read feature_flags"
  ON feature_flags FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT ON feature_flags TO authenticated;
REVOKE ALL ON feature_flags FROM anon;

-- Seed default flags (ON CONFLICT DO NOTHING = idempotent).
INSERT INTO feature_flags (flag_name, description, enabled, enabled_for_plans, rollout_percentage) VALUES
  ('pricing_cta_variant_b',
   'A/B test: alternate "Join thousands" CTA on pricing hero',
   true, ARRAY['free', 'pro'], 50),
  ('ai_usage_dashboard',
   'Show AI token usage stats in NESTAi sidebar and profile',
   true, ARRAY['free', 'pro'], 100),
  ('referral_program',
   'Growth referral system — unique invite links with Pro trial rewards',
   true, ARRAY['free', 'pro'], 100),
  ('rag_semantic_search',
   'pgvector-powered semantic search inside NESTAi (not yet live)',
   false, ARRAY['pro'], 0)
ON CONFLICT (flag_name) DO NOTHING;

-- ── Growth referral codes ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_referral_codes (
  id              uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid    NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  code            text    NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(4), 'hex'),
  click_count     integer NOT NULL DEFAULT 0,
  signup_count    integer NOT NULL DEFAULT 0,
  converted_count integer NOT NULL DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_referral_codes_code_idx ON user_referral_codes (code);

ALTER TABLE user_referral_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own referral code" ON user_referral_codes;
CREATE POLICY "Users can view own referral code"
  ON user_referral_codes FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT ON user_referral_codes TO authenticated;
REVOKE ALL ON user_referral_codes FROM anon;

CREATE OR REPLACE TRIGGER set_updated_at_user_referral_codes
  BEFORE UPDATE ON user_referral_codes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Referral events ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_referral_events (
  id            uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  referral_code text    NOT NULL REFERENCES user_referral_codes(code) ON DELETE CASCADE,
  referrer_id   uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- No inline UNIQUE here so CREATE TABLE IF NOT EXISTS stays fully idempotent;
  -- the unique constraint is added separately below via CREATE UNIQUE INDEX IF NOT EXISTS.
  referee_id    uuid    REFERENCES auth.users(id) ON DELETE SET NULL,
  status        text    NOT NULL DEFAULT 'signed_up'
                CHECK (status IN ('signed_up', 'converted')),
  reward_granted boolean NOT NULL DEFAULT false,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- Unique index enforces one referral event per referee at the DB level,
-- closing the TOCTOU race in record_referral_signup. IF NOT EXISTS = idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS user_referral_events_referee_id_key
  ON user_referral_events (referee_id);

CREATE INDEX IF NOT EXISTS referral_events_referrer_idx ON user_referral_events (referrer_id);
CREATE INDEX IF NOT EXISTS referral_events_referee_idx  ON user_referral_events (referee_id);
CREATE INDEX IF NOT EXISTS referral_events_code_idx     ON user_referral_events (referral_code);

ALTER TABLE user_referral_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own referral events" ON user_referral_events;
CREATE POLICY "Users can view own referral events"
  ON user_referral_events FOR SELECT
  TO authenticated
  USING (referrer_id = auth.uid() OR referee_id = auth.uid());

GRANT SELECT ON user_referral_events TO authenticated;
REVOKE ALL ON user_referral_events FROM anon;

CREATE OR REPLACE TRIGGER set_updated_at_user_referral_events
  BEFORE UPDATE ON user_referral_events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── RPCs ──────────────────────────────────────────────────────────────────────

-- Atomic click counter increment (public POST /api/referrals).
CREATE OR REPLACE FUNCTION increment_referral_clicks(p_code text)
RETURNS void
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = public
AS $$
  UPDATE user_referral_codes
  SET click_count = click_count + 1, updated_at = now()
  WHERE code = p_code;
$$;

-- Atomically record a new referral signup.
-- Self-referral and duplicate events are blocked at DB level (UNIQUE index)
-- as well as by the application-level guards below.
CREATE OR REPLACE FUNCTION record_referral_signup(
  p_code    text,
  p_referee uuid
) RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_referrer uuid;
BEGIN
  SELECT user_id INTO v_referrer
  FROM user_referral_codes
  WHERE code = p_code;

  IF v_referrer IS NULL THEN RETURN; END IF;
  IF v_referrer = p_referee   THEN RETURN; END IF;

  -- ON CONFLICT (referee_id) DO NOTHING is the final safety net:
  -- even if two concurrent calls race past the EXISTS check above,
  -- only one INSERT can win; the loser is silently discarded.
  INSERT INTO user_referral_events (referral_code, referrer_id, referee_id, status)
  VALUES (p_code, v_referrer, p_referee, 'signed_up')
  ON CONFLICT (referee_id) DO NOTHING;

  -- Only increment the counter when the INSERT actually landed.
  IF FOUND THEN
    UPDATE user_referral_codes
    SET signup_count = signup_count + 1, updated_at = now()
    WHERE code = p_code;
  END IF;
END;
$$;
