-- Migration: ats_score on job_applications
-- Stores the last ATS keyword overlap score (0–100) computed by /api/documents/ats-scan.
-- NULL = scan not yet run for this application.

ALTER TABLE job_applications
    ADD COLUMN IF NOT EXISTS ats_score SMALLINT
        CHECK (ats_score BETWEEN 0 AND 100);

COMMENT ON COLUMN job_applications.ats_score IS
    'Last ATS keyword overlap score (0–100) from /api/documents/ats-scan. NULL = not yet scanned.';
