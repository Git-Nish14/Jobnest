-- The bell listens to these tables. Keep publication setup reproducible instead
-- of requiring a manual Dashboard toggle. Existing RLS policies remain in force.
DO $$
DECLARE
  table_name text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  FOREACH table_name IN ARRAY ARRAY['notifications', 'reminders', 'interviews'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
        AND tablename = table_name
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', table_name);
    END IF;
    -- User-filtered UPDATE/DELETE subscriptions need the old user_id column.
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', table_name);
  END LOOP;
END $$;
