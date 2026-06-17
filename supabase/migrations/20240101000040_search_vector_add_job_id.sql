-- Migration: extend search_vector to include job_id
-- Ensures the command palette's full-text search path finds applications by
-- job ID in addition to company, position, location, and notes.

-- 1. Update the trigger function to include job_id
CREATE OR REPLACE FUNCTION update_job_applications_search_vector()
RETURNS trigger AS $$
BEGIN
    NEW.search_vector := to_tsvector(
        'english',
        coalesce(NEW.company, '') || ' ' ||
        coalesce(NEW.position, '') || ' ' ||
        coalesce(NEW.job_id, '') || ' ' ||
        coalesce(NEW.location, '') || ' ' ||
        coalesce(NEW.notes, '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Back-fill existing rows with the updated vector
UPDATE job_applications
SET search_vector = to_tsvector(
    'english',
    coalesce(company, '') || ' ' ||
    coalesce(position, '') || ' ' ||
    coalesce(job_id, '') || ' ' ||
    coalesce(location, '') || ' ' ||
    coalesce(notes, '')
);

COMMENT ON COLUMN job_applications.search_vector IS
    'GIN-indexed tsvector over company, position, job_id, location, notes. Kept current by trigger.';
