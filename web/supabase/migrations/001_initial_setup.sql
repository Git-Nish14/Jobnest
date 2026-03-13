-- =============================================
-- JOBNEST DATABASE SETUP
-- Run this SQL in your Supabase SQL Editor
-- Dashboard > SQL Editor > New Query
-- =============================================

-- 1. Create the job_applications table (if not exists)
CREATE TABLE IF NOT EXISTS public.job_applications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company TEXT NOT NULL,
    position TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Applied',
    applied_date DATE NOT NULL DEFAULT CURRENT_DATE,
    job_id TEXT,
    job_url TEXT,
    salary_range TEXT,
    location TEXT,
    notes TEXT,
    resume_path TEXT,
    cover_letter_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 2. Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_job_applications_user_id ON public.job_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_status ON public.job_applications(status);
CREATE INDEX IF NOT EXISTS idx_job_applications_applied_date ON public.job_applications(applied_date);

-- 3. Enable Row Level Security
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies (if any) to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own applications" ON public.job_applications;
DROP POLICY IF EXISTS "Users can create their own applications" ON public.job_applications;
DROP POLICY IF EXISTS "Users can update their own applications" ON public.job_applications;
DROP POLICY IF EXISTS "Users can delete their own applications" ON public.job_applications;

-- 5. Create RLS Policies

-- Policy: Users can only SELECT their own applications
CREATE POLICY "Users can view their own applications"
ON public.job_applications
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can only INSERT applications for themselves
CREATE POLICY "Users can create their own applications"
ON public.job_applications
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only UPDATE their own applications
CREATE POLICY "Users can update their own applications"
ON public.job_applications
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only DELETE their own applications
CREATE POLICY "Users can delete their own applications"
ON public.job_applications
FOR DELETE
USING (auth.uid() = user_id);

-- 6. Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Create trigger for updated_at
DROP TRIGGER IF EXISTS set_updated_at ON public.job_applications;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.job_applications
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 8. Grant permissions to authenticated users
GRANT ALL ON public.job_applications TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- =============================================
-- STORAGE BUCKET SETUP (for resume/cover letter uploads)
-- =============================================

-- Create storage bucket for documents (run separately if needed)
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('documents', 'documents', false)
-- ON CONFLICT (id) DO NOTHING;

-- Storage policies for documents bucket
-- Users can upload to their own folder
-- CREATE POLICY "Users can upload documents"
-- ON storage.objects
-- FOR INSERT
-- WITH CHECK (
--     bucket_id = 'documents' AND
--     auth.uid()::text = (storage.foldername(name))[1]
-- );

-- Users can view their own documents
-- CREATE POLICY "Users can view own documents"
-- ON storage.objects
-- FOR SELECT
-- USING (
--     bucket_id = 'documents' AND
--     auth.uid()::text = (storage.foldername(name))[1]
-- );

-- Users can delete their own documents
-- CREATE POLICY "Users can delete own documents"
-- ON storage.objects
-- FOR DELETE
-- USING (
--     bucket_id = 'documents' AND
--     auth.uid()::text = (storage.foldername(name))[1]
-- );

-- =============================================
-- VERIFICATION: Run these to check setup
-- =============================================
-- SELECT * FROM pg_policies WHERE tablename = 'job_applications';
-- SELECT * FROM information_schema.tables WHERE table_name = 'job_applications';
