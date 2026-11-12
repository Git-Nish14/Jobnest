-- Privileged accounting and referral RPCs are called only by the service role.
-- Table RLS does not protect SECURITY DEFINER functions from PUBLIC EXECUTE.
BEGIN;

REVOKE ALL ON FUNCTION public.increment_ai_usage(uuid, text, bigint, bigint, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_daily_token_usage(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.increment_referral_clicks(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_referral_signup(text, uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.increment_ai_usage(uuid, text, bigint, bigint, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_daily_token_usage(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_referral_clicks(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_referral_signup(text, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.increment_ai_usage(
  p_user_id uuid, p_feature text, p_input_tok bigint, p_output_tok bigint, p_model text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_input_tok IS NULL OR p_output_tok IS NULL OR p_input_tok < 0 OR p_output_tok < 0 THEN
    RAISE EXCEPTION 'Token increments must be nonnegative' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.ai_usage (user_id, date, feature, input_tokens, output_tokens, request_count, model)
  VALUES (p_user_id, CURRENT_DATE, p_feature, p_input_tok, p_output_tok, 1, p_model)
  ON CONFLICT (user_id, date, feature) DO UPDATE SET
    input_tokens = ai_usage.input_tokens + EXCLUDED.input_tokens,
    output_tokens = ai_usage.output_tokens + EXCLUDED.output_tokens,
    request_count = ai_usage.request_count + 1,
    model = EXCLUDED.model,
    updated_at = now();
END;
$$;

COMMIT;
