-- Migration: full-text search on job_applications
-- Adds a tsvector column kept in sync by a trigger, plus a GIN index for fast
-- phrase and keyword search across company, position, and notes fields.
-- Used by GET /api/search?q= and the command palette.

-- 1. Add the tsvector column
ALTER TABLE job_applications
    ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- 2. Back-fill existing rows
UPDATE job_applications
SET search_vector = to_tsvector(
    'english',
    coalesce(company, '') || ' ' ||
    coalesce(position, '') || ' ' ||
    coalesce(location, '') || ' ' ||
    coalesce(notes, '')
);

-- 3. GIN index for fast full-text lookups
CREATE INDEX IF NOT EXISTS job_applications_search_idx
    ON job_applications USING GIN (search_vector);

-- 4. Trigger function to keep the vector up to date on INSERT / UPDATE
CREATE OR REPLACE FUNCTION update_job_applications_search_vector()
RETURNS trigger AS $$
BEGIN
    NEW.search_vector := to_tsvector(
        'english',
        coalesce(NEW.company, '') || ' ' ||
        coalesce(NEW.position, '') || ' ' ||
        coalesce(NEW.location, '') || ' ' ||
        coalesce(NEW.notes, '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_job_applications_search ON job_applications;
CREATE TRIGGER trg_job_applications_search
    BEFORE INSERT OR UPDATE ON job_applications
    FOR EACH ROW EXECUTE FUNCTION update_job_applications_search_vector();

COMMENT ON COLUMN job_applications.search_vector IS
    'GIN-indexed tsvector over company, position, location, notes. Kept current by trigger.';
