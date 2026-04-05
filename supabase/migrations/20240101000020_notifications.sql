-- Migration: Create notifications table
-- Stores persistent in-app notifications with read/unread/delete state.
-- Notification types shipped initially:
--   overdue_reminder  — daily batch; one per reminder per source (deduped by source_id)
--   upcoming_interview — one per interview within next 24 h (deduped by source_id)
--   system             — manual/admin messages
--   account            — account lifecycle (deletion scheduled, reactivated, etc.)
--   billing            — payment failed, plan upgraded, etc.

-- ── Table ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type        TEXT        NOT NULL CHECK (type IN (
                              'overdue_reminder',
                              'upcoming_interview',
                              'system',
                              'account',
                              'billing'
                            )),
    title       TEXT        NOT NULL,
    body        TEXT,
    link        TEXT,
    is_read     BOOLEAN     NOT NULL DEFAULT FALSE,
    read_at     TIMESTAMPTZ,
    -- Optional back-reference so the cron can deduplicate:
    --   source_type = 'reminder' | 'interview' | null
    --   source_id   = UUID of the source row
    source_type TEXT,
    source_id   UUID,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
-- Fast per-user listing, newest first
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
    ON notifications (user_id, created_at DESC);

-- Fast unread count per user
CREATE INDEX IF NOT EXISTS idx_notifications_unread
    ON notifications (user_id)
    WHERE is_read = FALSE;

-- Deduplication: at most one notification per (user, source record).
-- The cron uses INSERT … ON CONFLICT DO NOTHING so re-running never
-- produces duplicates for the same source.  If a user deletes a notification
-- the unique record is gone and the next cron run may re-create it (desired
-- behaviour — the source is still overdue/upcoming so re-notification is correct).
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_source_dedup
    ON notifications (user_id, source_type, source_id)
    WHERE source_id IS NOT NULL;

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select"
    ON notifications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "notifications_update"
    ON notifications FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notifications_delete"
    ON notifications FOR DELETE
    USING (auth.uid() = user_id);

-- INSERT is performed only by the service-role (cron) — no user-level insert policy.
