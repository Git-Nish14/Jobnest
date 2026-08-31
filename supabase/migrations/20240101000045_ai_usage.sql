-- Migration 045: AI usage tracking for cost guardrails
-- Stores per-user, per-day, per-feature token consumption.
-- Only the service role can write; users can read their own rows.
-- Fully idempotent: safe to re-run if the previous version was already applied.

CREATE TABLE IF NOT EXISTS ai_usage (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date          date        NOT NULL DEFAULT CURRENT_DATE,
  feature       text        NOT NULL DEFAULT 'chat',
  input_tokens  bigint      NOT NULL DEFAULT 0,
  output_tokens bigint      NOT NULL DEFAULT 0,
  request_count integer     NOT NULL DEFAULT 0,
  model         text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE (user_id, date, feature)
);

CREATE INDEX IF NOT EXISTS ai_usage_user_date_idx ON ai_usage (user_id, date);

-- ENABLE ROW LEVEL SECURITY is a no-op if already enabled.
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

-- Drop then recreate so re-runs don't error on "policy already exists".
DROP POLICY IF EXISTS "Users can view own ai_usage" ON ai_usage;
CREATE POLICY "Users can view own ai_usage"
  ON ai_usage FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- All mutations go through the service-role RPC below.
GRANT SELECT ON ai_usage TO authenticated;
-- Defense-in-depth: explicitly deny anonymous access.
REVOKE ALL ON ai_usage FROM anon;

-- CREATE OR REPLACE TRIGGER is idempotent (PostgreSQL 14+).
CREATE OR REPLACE TRIGGER set_updated_at_ai_usage
  BEFORE UPDATE ON ai_usage
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Atomic upsert-increment so concurrent requests can't race on the same row.
-- Called via supabase.rpc('increment_ai_usage', {...}) from the service-role client.
CREATE OR REPLACE FUNCTION increment_ai_usage(
  p_user_id     uuid,
  p_feature     text,
  p_input_tok   bigint,
  p_output_tok  bigint,
  p_model       text
) RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  INSERT INTO ai_usage (user_id, date, feature, input_tokens, output_tokens, request_count, model)
  VALUES (p_user_id, CURRENT_DATE, p_feature, p_input_tok, p_output_tok, 1, p_model)
  ON CONFLICT (user_id, date, feature) DO UPDATE SET
    input_tokens  = ai_usage.input_tokens  + EXCLUDED.input_tokens,
    output_tokens = ai_usage.output_tokens + EXCLUDED.output_tokens,
    request_count = ai_usage.request_count + 1,
    model         = EXCLUDED.model,
    updated_at    = now();
END;
$$;

-- Daily token total for a user (used for cap enforcement).
-- Returns null on error — callers must fail-closed.
CREATE OR REPLACE FUNCTION get_daily_token_usage(p_user_id uuid)
RETURNS bigint
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = public
  STABLE
AS $$
  SELECT COALESCE(SUM(input_tokens + output_tokens), 0)
  FROM ai_usage
  WHERE user_id = p_user_id
    AND date = CURRENT_DATE;
$$;
