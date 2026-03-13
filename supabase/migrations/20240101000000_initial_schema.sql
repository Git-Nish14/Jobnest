-- Migration: Initial Schema
-- Description: Create job_applications table with RLS policies
-- Created: Initial setup

-- =============================================
-- EXTENSIONS
-- =============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- CUSTOM TYPES
-- =============================================
DO $$ BEGIN
    CREATE TYPE application_status AS ENUM (
        'Applied',
        'Phone Screen',
        'Interview',
        'Offer',
        'Rejected'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- =============================================
-- TABLES
-- =============================================
CREATE TABLE IF NOT EXISTS job_applications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

    -- Core fields
    company VARCHAR(255) NOT NULL,
    position VARCHAR(255) NOT NULL,
    status application_status DEFAULT 'Applied' NOT NULL,
    applied_date DATE DEFAULT CURRENT_DATE NOT NULL,

    -- Optional details
    job_id VARCHAR(100),
    job_url TEXT,
    salary_range VARCHAR(100),
    location VARCHAR(255),
    notes TEXT,

    -- File references (stored in Supabase Storage)
    resume_path TEXT,
    cover_letter_path TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    -- Constraints
    CONSTRAINT valid_job_url CHECK (job_url IS NULL OR job_url ~* '^https?://'),
    CONSTRAINT company_not_empty CHECK (LENGTH(TRIM(company)) > 0),
    CONSTRAINT position_not_empty CHECK (LENGTH(TRIM(position)) > 0)
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_job_applications_user_id
    ON job_applications(user_id);

CREATE INDEX IF NOT EXISTS idx_job_applications_status
    ON job_applications(status);

CREATE INDEX IF NOT EXISTS idx_job_applications_applied_date
    ON job_applications(applied_date DESC);

CREATE INDEX IF NOT EXISTS idx_job_applications_company
    ON job_applications(company);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_job_applications_user_status
    ON job_applications(user_id, status);

CREATE INDEX IF NOT EXISTS idx_job_applications_user_date
    ON job_applications(user_id, applied_date DESC);

-- =============================================
-- TRIGGERS
-- =============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_job_applications_updated_at ON job_applications;
CREATE TRIGGER update_job_applications_updated_at
    BEFORE UPDATE ON job_applications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;

-- Force RLS for table owners too
ALTER TABLE job_applications FORCE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own applications" ON job_applications;
DROP POLICY IF EXISTS "Users can insert own applications" ON job_applications;
DROP POLICY IF EXISTS "Users can update own applications" ON job_applications;
DROP POLICY IF EXISTS "Users can delete own applications" ON job_applications;

-- SELECT: Users can only view their own applications
CREATE POLICY "Users can view own applications"
    ON job_applications
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- INSERT: Users can only insert applications for themselves
CREATE POLICY "Users can insert own applications"
    ON job_applications
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- UPDATE: Users can only update their own applications
CREATE POLICY "Users can update own applications"
    ON job_applications
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- DELETE: Users can only delete their own applications
CREATE POLICY "Users can delete own applications"
    ON job_applications
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- =============================================
-- COMMENTS
-- =============================================
COMMENT ON TABLE job_applications IS 'Stores job application tracking data for users';
COMMENT ON COLUMN job_applications.user_id IS 'References the authenticated user who owns this application';
COMMENT ON COLUMN job_applications.status IS 'Current status in the application pipeline';
COMMENT ON COLUMN job_applications.resume_path IS 'Path to resume file in Supabase Storage';
COMMENT ON COLUMN job_applications.cover_letter_path IS 'Path to cover letter file in Supabase Storage';
