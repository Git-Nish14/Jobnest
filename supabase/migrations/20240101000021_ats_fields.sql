-- Migration: ATS fields — job_description, source, Ghosted + Withdrawn statuses
-- Adds columns needed for Application Quality & ATS features and US-market tracking.

-- =============================================
-- 1. Extend application_status enum
-- =============================================
DO $$ BEGIN
    ALTER TYPE application_status ADD VALUE IF NOT EXISTS 'Withdrawn';
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TYPE application_status ADD VALUE IF NOT EXISTS 'Ghosted';
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- =============================================
-- 2. New columns on job_applications
-- =============================================

-- Full job description text (powers ATS scan, NESTAi tailoring, keyword extraction)
ALTER TABLE job_applications
    ADD COLUMN IF NOT EXISTS job_description TEXT;

-- Source / channel where the user found the listing
-- Free-text kept short (≤ 60 chars) so the UI can display it without truncation.
ALTER TABLE job_applications
    ADD COLUMN IF NOT EXISTS source VARCHAR(60);

-- =============================================
-- 3. Comments
-- =============================================
COMMENT ON COLUMN job_applications.job_description IS 'Full job description text for ATS scanning and NESTAi analysis';
COMMENT ON COLUMN job_applications.source         IS 'Where the listing was found: LinkedIn, Indeed, Referral, etc.';
