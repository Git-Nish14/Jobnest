-- Run against a disposable database after migration 56. Leaves no test data.
BEGIN;
INSERT INTO auth.users(id, raw_user_meta_data) VALUES
  ('a1111111-1111-4111-8111-111111111111', '{"portfolio_public":true}'),
  ('a2222222-2222-4222-8222-222222222222', '{"portfolio_public":false}');
INSERT INTO public.skills(id, user_id, name, category, proficiency)
SELECT ('b1111111-1111-4111-8111-' || lpad(i::text,12,'0'))::uuid,
  'a1111111-1111-4111-8111-111111111111', 'Skill ' || i, 'Other', 'Advanced'
FROM generate_series(1, 22) i;
INSERT INTO public.skills(id, user_id, name, category, proficiency) VALUES
  ('b2222222-2222-4222-8222-222222222222', 'a2222222-2222-4222-8222-222222222222', 'Private', 'Other', 'Expert');

DO $$
DECLARE
  owner_id uuid := 'a1111111-1111-4111-8111-111111111111';
  target uuid := 'b1111111-1111-4111-8111-000000000001';
  result record;
  failed boolean;
BEGIN
  SELECT * INTO result FROM public.endorse_public_skill(owner_id, target, repeat('a',64), repeat('b',64));
  ASSERT result.endorsement_count = 1 AND result.endorsed, 'first vote must persist';
  PERFORM public.endorse_public_skill(owner_id, target, repeat('a',64), repeat('b',64));
  PERFORM public.endorse_public_skill(owner_id, target, repeat('c',64), repeat('b',64));
  PERFORM public.endorse_public_skill(owner_id, target, repeat('a',64), repeat('d',64));
  SELECT * INTO result FROM public.get_public_skill_endorsements(owner_id, repeat('c',64), repeat('b',64)) WHERE skill_id = target;
  ASSERT result.endorsement_count = 1 AND result.endorsed, 'browser/network duplicates must be idempotent';
  SELECT * INTO result FROM public.get_public_skill_endorsements(owner_id, repeat('e',64), repeat('f',64)) WHERE skill_id = target;
  ASSERT result.endorsement_count = 1 AND NOT result.endorsed, 'other visitors see count only';

  failed := false;
  BEGIN
    PERFORM public.endorse_public_skill(owner_id, 'b2222222-2222-4222-8222-222222222222', repeat('a',64), repeat('b',64));
  EXCEPTION WHEN raise_exception THEN failed := SQLERRM = 'endorsement_skill_not_found'; END;
  ASSERT failed, 'cross-owner skills must be rejected';
  failed := false;
  BEGIN
    PERFORM public.endorse_public_skill('a2222222-2222-4222-8222-222222222222', 'b2222222-2222-4222-8222-222222222222', repeat('a',64), repeat('b',64));
  EXCEPTION WHEN raise_exception THEN failed := SQLERRM = 'endorsement_skill_not_found'; END;
  ASSERT failed, 'private portfolios must reject votes';
  ASSERT NOT EXISTS (SELECT 1 FROM public.get_public_skill_endorsements('a2222222-2222-4222-8222-222222222222', repeat('a',64), repeat('b',64))), 'private counts must be hidden';

  FOR i IN 2..20 LOOP
    PERFORM public.endorse_public_skill(owner_id, ('b1111111-1111-4111-8111-' || lpad(i::text,12,'0'))::uuid, repeat('a',64), repeat('b',64));
  END LOOP;
  failed := false;
  BEGIN
    PERFORM public.endorse_public_skill(owner_id, 'b1111111-1111-4111-8111-000000000021', repeat('a',64), repeat('b',64));
  EXCEPTION WHEN raise_exception THEN failed := SQLERRM = 'endorsement_daily_limit'; END;
  ASSERT failed, 'database must enforce daily limit';
  PERFORM public.endorse_public_skill(owner_id, target, repeat('a',64), repeat('b',64));

  UPDATE auth.users SET raw_user_meta_data = '{"portfolio_public":false}' WHERE id = owner_id;
  ASSERT NOT EXISTS (SELECT 1 FROM public.get_public_skill_endorsements(owner_id, repeat('a',64), repeat('b',64))), 'unpublishing hides counts immediately';
  failed := false;
  BEGIN
    PERFORM public.endorse_public_skill(owner_id, target, repeat('e',64), repeat('f',64));
  EXCEPTION WHEN raise_exception THEN failed := SQLERRM = 'endorsement_skill_not_found'; END;
  ASSERT failed, 'unpublishing prevents writes';
  DELETE FROM public.skills WHERE id = target;
  ASSERT NOT EXISTS (SELECT 1 FROM public.portfolio_skill_endorsements WHERE skill_id = target), 'skill deletion must cascade';
END;
$$;

SET LOCAL ROLE anon;
DO $$
DECLARE failed boolean := false;
BEGIN
  BEGIN PERFORM * FROM public.portfolio_skill_endorsements;
  EXCEPTION WHEN insufficient_privilege THEN failed := true; END;
  ASSERT failed, 'anonymous callers must not read identities';
  failed := false;
  BEGIN PERFORM public.get_public_skill_endorsements('a1111111-1111-4111-8111-111111111111', repeat('a',64), repeat('b',64));
  EXCEPTION WHEN insufficient_privilege THEN failed := true; END;
  ASSERT failed, 'anonymous callers must not invoke service RPCs';
END;
$$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $$
DECLARE failed boolean := false;
BEGIN
  BEGIN INSERT INTO public.portfolio_skill_endorsements(skill_id, visitor_hash, network_hash)
    VALUES('b1111111-1111-4111-8111-000000000002', repeat('e',64), repeat('f',64));
  EXCEPTION WHEN insufficient_privilege THEN failed := true; END;
  ASSERT failed, 'authenticated clients must not bypass the API';
END;
$$;
RESET ROLE;
ROLLBACK;
