-- Migration: Storage Setup
-- Description: Create storage bucket and policies for document uploads
-- Created: Initial setup

-- =============================================
-- STORAGE BUCKET
-- =============================================
-- Note: Bucket creation must be done via Dashboard or Supabase CLI
-- This migration sets up the policies assuming the bucket exists

-- Insert bucket if it doesn't exist (requires service role)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'documents',
    'documents',
    false,  -- Private bucket
    5242880,  -- 5MB limit
    ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- =============================================
-- STORAGE POLICIES
-- =============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own documents" ON storage.objects;

-- INSERT: Users can upload files to their own folder
-- File path format: {user_id}/{application_id}/{filename}
CREATE POLICY "Users can upload own documents"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'documents'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- SELECT: Users can view/download their own files
CREATE POLICY "Users can view own documents"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'documents'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- UPDATE: Users can update their own files
CREATE POLICY "Users can update own documents"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'documents'
        AND (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
        bucket_id = 'documents'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- DELETE: Users can delete their own files
CREATE POLICY "Users can delete own documents"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'documents'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );
