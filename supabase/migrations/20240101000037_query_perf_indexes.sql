-- Migration: Query performance indexes
-- Fixes four issues identified from pg_stat_statements slow-query analysis:
--
-- 1. Add composite index on interviews(user_id, status, scheduled_at) for the
--    calendar/notification query that hits 2 326 times.  The three existing
--    single-column indexes (user_id, status, scheduled_at) force Postgres to
--    pick one and filter the rest in memory.
--
-- 2. Add (user_id, applied_date DESC, id DESC) to job_applications so that
--    paginated queries ordered by both columns can be served from the index
--    without a separate sort pass.  The existing (user_id, applied_date DESC)
--    index still handles the single-column ORDER BY variant.
--
-- 3. Drop idx_job_applications_status.  All app queries filter by user_id first
--    (injected by RLS), so a lone status index is never chosen by the planner.
--
-- 4. Drop the three now-redundant single-column indexes on interviews
--    (user_id, status, scheduled_at) that are fully covered by the new
--    composite.  idx_interviews_application_id is kept (FK lookup pattern).
--
-- 5. Make the search-vector trigger conditional: skip the expensive to_tsvector()
--    call when none of the indexed columns (company, position, location, notes)
--    actually changed.  This is the main cause of the 278 ms mean UPDATE time —
--    status changes and resume_path updates were recomputing tsvector for free.

-- ── New indexes ───────────────────────────────────────────────────────────────

-- Covers: WHERE user_id = $1 AND status = $2
--         AND scheduled_at >= $3 AND scheduled_at <= $4
CREATE INDEX IF NOT EXISTS idx_interviews_user_status_scheduled
    ON interviews (user_id, status, scheduled_at);

-- Covers: ORDER BY applied_date DESC, id DESC  (secondary-sort pagination)
CREATE INDEX IF NOT EXISTS idx_job_applications_user_date_id
    ON job_applications (user_id, applied_date DESC, id DESC);

-- ── Drop redundant single-column indexes ──────────────────────────────────────

-- Covered by idx_job_applications_user_status and idx_job_applications_user_date
DROP INDEX IF EXISTS public.idx_job_applications_status;

-- All three covered by the new idx_interviews_user_status_scheduled
DROP INDEX IF EXISTS public.idx_interviews_user_id;
DROP INDEX IF EXISTS public.idx_interviews_status;
DROP INDEX IF EXISTS public.idx_interviews_scheduled_at;

-- ── Conditional search-vector trigger ────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_job_applications_search_vector()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Only recompute when a searchable column actually changed.
    -- On INSERT, OLD is NULL so every IS DISTINCT FROM check is true.
    IF (TG_OP = 'INSERT') OR (
        NEW.company  IS DISTINCT FROM OLD.company  OR
        NEW.position IS DISTINCT FROM OLD.position OR
        NEW.location IS DISTINCT FROM OLD.location OR
        NEW.notes    IS DISTINCT FROM OLD.notes
    ) THEN
        NEW.search_vector := to_tsvector(
            'english',
            coalesce(NEW.company,   '') || ' ' ||
            coalesce(NEW.position,  '') || ' ' ||
            coalesce(NEW.location,  '') || ' ' ||
            coalesce(NEW.notes,     '')
        );
    END IF;
    RETURN NEW;
END;
$$;
