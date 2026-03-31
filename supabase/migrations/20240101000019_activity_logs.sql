-- Migration: Create activity_logs table
-- Description: The activity_logs table and its supporting enum were defined in
--   migration 003 but the table was not present in the database, causing the
--   existing application_activity_trigger to fail on every INSERT/UPDATE to
--   job_applications with "relation activity_logs does not exist" (42P01).
--   This migration is idempotent — safe to run even if parts already exist.

-- ── Enum (created in 003; guard against duplicates) ─────────────────────────
DO $$ BEGIN
    CREATE TYPE activity_type AS ENUM (
        'Created',
        'Status Changed',
        'Interview Scheduled',
        'Interview Completed',
        'Note Added',
        'Document Uploaded',
        'Reminder Set',
        'Contact Added',
        'Updated'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ── Table ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_logs (
    id             UUID         DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id        UUID         REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    application_id UUID         REFERENCES job_applications(id) ON DELETE CASCADE NOT NULL,
    activity_type  activity_type NOT NULL,
    description    TEXT         NOT NULL,
    metadata       JSONB        DEFAULT '{}',
    created_at     TIMESTAMPTZ  DEFAULT NOW() NOT NULL
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id        ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_application_id ON activity_logs(application_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at     ON activity_logs(created_at DESC);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own activity logs"   ON activity_logs;
DROP POLICY IF EXISTS "Users can insert own activity logs" ON activity_logs;

CREATE POLICY "Users can view own activity logs"
    ON activity_logs FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

-- Inserts come only from the trigger function (SECURITY DEFINER), which runs as
-- the table owner and bypasses RLS automatically.  This policy covers any direct
-- client inserts.
CREATE POLICY "Users can insert own activity logs"
    ON activity_logs FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- ── Re-create trigger function + trigger (idempotent) ─────────────────────────
CREATE OR REPLACE FUNCTION log_application_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO activity_logs (user_id, application_id, activity_type, description, metadata)
        VALUES (
            NEW.user_id,
            NEW.id,
            'Created',
            'Application created for ' || NEW.position || ' at ' || NEW.company,
            '{}'
        );
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            INSERT INTO activity_logs (user_id, application_id, activity_type, description, metadata)
            VALUES (
                NEW.user_id,
                NEW.id,
                'Status Changed',
                'Status changed from ' || OLD.status || ' to ' || NEW.status,
                jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status)
            );
        ELSE
            INSERT INTO activity_logs (user_id, application_id, activity_type, description, metadata)
            VALUES (
                NEW.user_id,
                NEW.id,
                'Updated',
                'Application details updated',
                '{}'
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS application_activity_trigger ON job_applications;
CREATE TRIGGER application_activity_trigger
    AFTER INSERT OR UPDATE ON job_applications
    FOR EACH ROW
    EXECUTE FUNCTION log_application_activity();

COMMENT ON TABLE activity_logs IS 'Audit trail of all application activities';
