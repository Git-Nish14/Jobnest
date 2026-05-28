-- Migration 35: Document purge queue
-- When an application is rejected, a 30-day countdown begins before its
-- Storage files are deleted. This table tracks that countdown and the
-- notification cadence (every 5 days). The application row itself is never
-- deleted; only the Storage objects are removed.

-- ── Extend notifications type check to include document_purge ─────────────
ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'overdue_reminder',
    'upcoming_interview',
    'system',
    'account',
    'billing',
    'document_purge'
  ));

-- ── document_purge_queue ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_purge_queue (
    id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- One entry per application; unique prevents double-scheduling on re-rejection.
    application_id   UUID        NOT NULL UNIQUE
                                 REFERENCES job_applications(id) ON DELETE CASCADE,
    user_id          UUID        NOT NULL
                                 REFERENCES auth.users(id) ON DELETE CASCADE,
    -- When Storage files will be purged (rejection timestamp + 30 days).
    purge_at         TIMESTAMPTZ NOT NULL,
    -- Tracks notification cadence so the cron can fire every 5 days.
    last_notified_at TIMESTAMPTZ,
    notif_count      INTEGER     NOT NULL DEFAULT 0,
    -- pending → files still exist and countdown is active
    -- retained → user chose to keep files (purge cancelled)
    -- purged   → Storage files have been deleted
    status           TEXT        NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending', 'retained', 'purged')),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purge_queue_user
    ON document_purge_queue (user_id);

CREATE INDEX IF NOT EXISTS idx_purge_queue_pending
    ON document_purge_queue (purge_at)
    WHERE status = 'pending';

-- ── RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE document_purge_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_purge_queue FORCE ROW LEVEL SECURITY;

-- Explicitly deny all operations for the anon role; don't rely on
-- FORCE RLS null-check semantics for unauthenticated callers.
REVOKE ALL ON document_purge_queue FROM anon;

-- Authenticated users can only see their own queue entries (for the retain UI).
-- Scoped to `authenticated` so the anon role cannot even attempt a SELECT.
-- INSERT/UPDATE/DELETE are performed only by the service-role trigger and
-- the admin client in the cron/retain endpoints — no user-level policies needed.
CREATE POLICY "purge_queue_select"
    ON document_purge_queue FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- ── DB trigger: schedule purge when status → Rejected ────────────────────
CREATE OR REPLACE FUNCTION schedule_document_purge()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.status = 'Rejected' AND (OLD.status IS DISTINCT FROM 'Rejected') THEN
        INSERT INTO document_purge_queue (application_id, user_id, purge_at)
        VALUES (NEW.id, NEW.user_id, NOW() + INTERVAL '30 days')
        ON CONFLICT (application_id) DO NOTHING;
        -- ON CONFLICT: if an entry already exists (e.g. re-rejected after retain),
        -- do not reset the original purge timer.
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_schedule_document_purge ON job_applications;

CREATE TRIGGER trg_schedule_document_purge
    AFTER UPDATE ON job_applications
    FOR EACH ROW
    EXECUTE FUNCTION schedule_document_purge();

-- ── Comments ──────────────────────────────────────────────────────────────
COMMENT ON TABLE document_purge_queue IS
    'Countdown table for auto-deleting Storage files 30 days after rejection. Application rows are never deleted.';
COMMENT ON COLUMN document_purge_queue.purge_at IS
    'UTC timestamp when Storage files will be deleted (rejected_at + 30 days).';
COMMENT ON COLUMN document_purge_queue.status IS
    'pending = countdown active; retained = user cancelled purge; purged = files deleted.';
