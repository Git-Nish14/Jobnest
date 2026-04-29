-- Migration: sponsorship flag on job_applications
-- Tracks whether each role requires visa sponsorship (H1B/OPT/EAD).
-- OPT expiry dates (opt_start_date, stem_extension) are stored in auth.users.user_metadata
-- alongside the existing work_authorization field — no separate DB column needed.

ALTER TABLE job_applications
    ADD COLUMN IF NOT EXISTS requires_sponsorship BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN job_applications.requires_sponsorship IS
    'True when the role requires H1B/OPT/EAD visa sponsorship. Used for filtering and the Visa badge on cards.';