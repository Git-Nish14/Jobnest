-- Migration 044: Glassdoor rating per application
-- Stores a user-entered Glassdoor-style rating (1.0 – 5.0) on each application.
-- Single decimal place; CHECK enforces the allowed range so no bad data reaches the DB.

ALTER TABLE job_applications
  ADD COLUMN IF NOT EXISTS glassdoor_rating NUMERIC(3,1)
    CHECK (glassdoor_rating IS NULL OR (glassdoor_rating >= 1.0 AND glassdoor_rating <= 5.0));

COMMENT ON COLUMN job_applications.glassdoor_rating
  IS 'User-entered company rating (1.0–5.0), sourced from Glassdoor or personal assessment.';
