-- Run after migration 057 in an isolated test database. No fixtures are retained.
BEGIN;
DO $$
DECLARE
  signature text;
  caller text;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'public.increment_ai_usage(uuid,text,bigint,bigint,text)',
    'public.get_daily_token_usage(uuid)',
    'public.increment_referral_clicks(text)',
    'public.record_referral_signup(text,uuid)'
  ] LOOP
    FOREACH caller IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF has_function_privilege(caller, signature, 'EXECUTE') THEN
        RAISE EXCEPTION '% must not execute %', caller, signature;
      END IF;
    END LOOP;
    IF NOT has_function_privilege('service_role', signature, 'EXECUTE') THEN
      RAISE EXCEPTION 'service_role must execute %', signature;
    END IF;
  END LOOP;
  BEGIN
    PERFORM public.increment_ai_usage(NULL, 'chat', -1, 0, 'fixture');
    RAISE EXCEPTION 'Negative token increments were accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
END;
$$;
ROLLBACK;
