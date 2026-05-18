-- Migration 32: Add ats_provider field to job_applications
-- Tracks which ATS/portal was used to submit the application (Workday, Lever, Greenhouse, etc.)
--
-- Constraint rationale:
--   - NULL = user hasn't set a portal (valid)
--   - Non-null must be non-empty and ≤ 100 chars
--     Guards against empty-string writes and excessively long values that
--     bypass the client-side Zod enum — consistent with the existing
--     company_not_empty / valid_job_url checks on this table.

ALTER TABLE job_applications
  ADD COLUMN IF NOT EXISTS ats_provider TEXT;

-- Drop first so this migration is re-runnable (idempotent)
ALTER TABLE job_applications
  DROP CONSTRAINT IF EXISTS job_applications_ats_provider_check;

ALTER TABLE job_applications
  ADD CONSTRAINT job_applications_ats_provider_check
  CHECK (
    ats_provider IS NULL
    OR (char_length(ats_provider) BETWEEN 1 AND 100)
  );
