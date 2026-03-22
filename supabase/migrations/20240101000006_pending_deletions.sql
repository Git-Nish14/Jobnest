-- Migration: Pending Deletions + OTP purpose update
-- Description: Soft-delete flow (30-day grace period) and allow change_password OTP purpose

-- =============================================
-- UPDATE OTP CODES CONSTRAINT
-- Allow 'change_password' as a valid OTP purpose
-- =============================================
ALTER TABLE otp_codes DROP CONSTRAINT IF EXISTS valid_purpose;
ALTER TABLE otp_codes ADD CONSTRAINT valid_purpose
    CHECK (purpose IN ('login', 'signup', 'password_reset', 'change_password'));

-- =============================================
-- PENDING DELETIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS pending_deletions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL,          -- auth.users id (not FK so record survives edge cases)
    email TEXT NOT NULL,            -- stored separately for reminder emails
    scheduled_deletion_at TIMESTAMPTZ NOT NULL,  -- now() + 30 days
    last_reminder_sent_at TIMESTAMPTZ,           -- NULL = initial email only
    reminder_count INTEGER NOT NULL DEFAULT 0,
    cancelled_at TIMESTAMPTZ,                    -- NULL = still pending deletion
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_active_pending_deletion UNIQUE (user_id, cancelled_at)
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_pending_deletions_user_id
    ON pending_deletions(user_id);

CREATE INDEX IF NOT EXISTS idx_pending_deletions_scheduled_at
    ON pending_deletions(scheduled_deletion_at)
    WHERE cancelled_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pending_deletions_reminder
    ON pending_deletions(last_reminder_sent_at)
    WHERE cancelled_at IS NULL;

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
ALTER TABLE pending_deletions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_deletions FORCE ROW LEVEL SECURITY;

-- Only service role can access (managed entirely through server-side API)
DROP POLICY IF EXISTS "Service role only" ON pending_deletions;
CREATE POLICY "Service role only"
    ON pending_deletions
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- =============================================
-- COMMENTS
-- =============================================
COMMENT ON TABLE pending_deletions IS 'Tracks accounts scheduled for deletion with 30-day grace period';
COMMENT ON COLUMN pending_deletions.scheduled_deletion_at IS 'When the account will be permanently deleted (30 days after request)';
COMMENT ON COLUMN pending_deletions.last_reminder_sent_at IS 'Timestamp of last reminder email; NULL means only the initial email was sent';
COMMENT ON COLUMN pending_deletions.reminder_count IS 'Number of reminder emails sent (every 7 days)';
COMMENT ON COLUMN pending_deletions.cancelled_at IS 'Set when user reactivates — NULL means deletion is still pending';
