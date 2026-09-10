-- Migration: extend full-text search to include job_description
-- Updates the trigger function so searches across company, position, location,
-- notes, AND job_description (JD paste) all hit the GIN index.
-- Back-fills existing rows with the updated vector.

CREATE OR REPLACE FUNCTION update_job_applications_search_vector()
RETURNS trigger AS $$
BEGIN
    NEW.search_vector := to_tsvector(
        'english',
        coalesce(NEW.company, '') || ' ' ||
        coalesce(NEW.position, '') || ' ' ||
        coalesce(NEW.location, '') || ' ' ||
        coalesce(NEW.notes, '') || ' ' ||
        coalesce(NEW.job_description, '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Back-fill existing rows — the GIN index is updated automatically
UPDATE job_applications
SET search_vector = to_tsvector(
    'english',
    coalesce(company, '') || ' ' ||
    coalesce(position, '') || ' ' ||
    coalesce(location, '') || ' ' ||
    coalesce(notes, '') || ' ' ||
    coalesce(job_description, '')
);

COMMENT ON COLUMN job_applications.search_vector IS
    'GIN-indexed tsvector over company, position, location, notes, job_description. Kept current by trigger.';
