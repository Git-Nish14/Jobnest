-- Migration: Pending Deletions improvements
-- Fixes: broken UNIQUE constraint (NULL != NULL in PG), adds audit columns,
--        final warning tracking, and delete_account OTP purpose.

-- =============================================
-- 1. FIX BROKEN UNIQUE CONSTRAINT
-- UNIQUE (user_id, cancelled_at) does NOT prevent duplicate active rows
-- because PostgreSQL treats NULL as distinct — two rows with cancelled_at=NULL
-- are considered unique, allowing multiple active pending deletions per user.
-- Solution: partial unique index scoped to only active (uncancelled) rows.
-- =============================================
ALTER TABLE pending_deletions
    DROP CONSTRAINT IF EXISTS unique_active_pending_deletion;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_deletions_one_active
    ON pending_deletions(user_id)
    WHERE cancelled_at IS NULL;

-- =============================================
-- 2. ADD AUDIT + FEATURE COLUMNS
-- =============================================
ALTER TABLE pending_deletions
    ADD COLUMN IF NOT EXISTS final_warning_sent_at TIMESTAMPTZ,   -- 24h-before email
    ADD COLUMN IF NOT EXISTS reason                TEXT,           -- optional user reason
    ADD COLUMN IF NOT EXISTS ip_address            TEXT,           -- IP at time of request
    ADD COLUMN IF NOT EXISTS deleted_at            TIMESTAMPTZ;    -- set when permanently processed

COMMENT ON COLUMN pending_deletions.final_warning_sent_at IS '24-hour final warning email timestamp';
COMMENT ON COLUMN pending_deletions.reason IS 'Optional reason provided by the user at deletion time';
COMMENT ON COLUMN pending_deletions.ip_address IS 'Client IP at time of deletion request (audit trail)';
COMMENT ON COLUMN pending_deletions.deleted_at IS 'When the account was permanently deleted by the cron job';

-- =============================================
-- 3. ADD INDEX FOR FINAL WARNING QUERY
-- =============================================
CREATE INDEX IF NOT EXISTS idx_pending_deletions_final_warning
    ON pending_deletions(scheduled_deletion_at)
    WHERE cancelled_at IS NULL AND final_warning_sent_at IS NULL;

-- =============================================
-- 4. UPDATE OTP PURPOSE CONSTRAINT
-- Allow delete_account as a valid OTP purpose
-- =============================================
ALTER TABLE otp_codes DROP CONSTRAINT IF EXISTS valid_purpose;
ALTER TABLE otp_codes ADD CONSTRAINT valid_purpose
    CHECK (purpose IN ('login', 'signup', 'password_reset', 'change_password', 'delete_account'));
