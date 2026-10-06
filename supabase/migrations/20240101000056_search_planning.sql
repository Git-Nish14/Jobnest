ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS saved_date date;
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS submitted_at timestamptz;
COMMENT ON COLUMN public.job_applications.submitted_at IS 'When the user first recorded submission from Saved/Preparing; not an employer-verified timestamp.';

-- Preserve existing applied_date history; do not invent past submission timestamps.
CREATE OR REPLACE FUNCTION public.capture_submission_date() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE user_tz text;
BEGIN
  IF NEW.status::text IN ('Saved', 'Preparing') THEN
    NEW.saved_date := coalesce(NEW.saved_date, NEW.applied_date);
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status::text IN ('Saved', 'Preparing') AND OLD.submitted_at IS NULL AND NEW.status::text <> 'Withdrawn'
      AND NOT EXISTS (
        SELECT 1 FROM public.activity_logs l WHERE l.application_id = OLD.id
          AND (l.metadata->>'initial_status' IN ('Applied', 'Phone Screen', 'Interview', 'Offer', 'Accepted')
            OR l.metadata->>'old_status' IN ('Applied', 'Phone Screen', 'Interview', 'Offer', 'Accepted')
            OR l.metadata->>'new_status' IN ('Applied', 'Phone Screen', 'Interview', 'Offer', 'Accepted'))
      ) THEN
      SELECT coalesce(u.raw_user_meta_data->>'timezone', 'UTC') INTO user_tz
        FROM auth.users u WHERE u.id = NEW.user_id;
      IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = user_tz) THEN user_tz := 'UTC'; END IF;
      -- Retain an explicitly edited historical date, otherwise anchor first submission now.
      IF NEW.applied_date = OLD.applied_date THEN
        NEW.applied_date := (CURRENT_TIMESTAMP AT TIME ZONE user_tz)::date;
      END IF;
      NEW.submitted_at := CURRENT_TIMESTAMP;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS capture_submission_date ON public.job_applications;
CREATE TRIGGER capture_submission_date BEFORE INSERT OR UPDATE ON public.job_applications
FOR EACH ROW EXECUTE FUNCTION public.capture_submission_date();

-- Keep existing activity history, and record initial stage for new imports.
CREATE OR REPLACE FUNCTION public.log_application_activity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_logs(user_id, application_id, activity_type, description, metadata)
    VALUES(NEW.user_id, NEW.id, 'Created', 'Application created', jsonb_build_object('initial_status', NEW.status));
  ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.activity_logs(user_id, application_id, activity_type, description, metadata)
    VALUES(NEW.user_id, NEW.id, 'Status Changed', 'Status changed from ' || OLD.status || ' to ' || NEW.status,
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status));
  ELSE
    INSERT INTO public.activity_logs(user_id, application_id, activity_type, description, metadata)
    VALUES(NEW.user_id, NEW.id, 'Updated', 'Application details updated', '{}');
  END IF;
  RETURN NEW;
END $$;

CREATE TABLE IF NOT EXISTS public.search_plan_tasks (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  task_key text NOT NULL CHECK(length(task_key) BETWEEN 1 AND 120),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'dismissed')),
  scheduled_date date,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id, week_start, task_key),
  CHECK(scheduled_date IS NULL OR scheduled_date BETWEEN week_start AND week_start + 6)
);
ALTER TABLE public.search_plan_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_plan_tasks FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.search_plan_tasks FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.search_plan_tasks TO authenticated;
DROP POLICY IF EXISTS search_plan_tasks_own ON public.search_plan_tasks;
CREATE POLICY search_plan_tasks_own ON public.search_plan_tasks FOR ALL TO authenticated
USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

-- Rejection closes a role, but its submitted documents remain useful search history.
-- Stop automatic future purges. Existing queued files are retained, not deleted.
DROP TRIGGER IF EXISTS trg_schedule_document_purge ON public.job_applications;
UPDATE public.document_purge_queue SET status = 'retained' WHERE status = 'pending';
