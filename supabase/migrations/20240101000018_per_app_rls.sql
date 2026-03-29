-- Migration 18: Per-application Storage RLS
-- Tightens the Storage bucket policy so that for 4-part paths
-- ({user_id}/{application_id}/{label}/{filename}) the application_id must
-- belong to the authenticated user in job_applications.
--
-- Helper function: verifies that a given application_id belongs to the caller.
-- Called from storage policies. Uses SECURITY DEFINER with a fixed search_path
-- to prevent privilege escalation.

CREATE OR REPLACE FUNCTION public.user_owns_application(p_app_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ok BOOLEAN;
BEGIN
    -- Skip check for library paths (application_id segment is 'library')
    IF p_app_id = 'library' THEN
        RETURN TRUE;
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM public.job_applications
        WHERE id::text = p_app_id
          AND user_id  = auth.uid()
    ) INTO v_ok;

    RETURN COALESCE(v_ok, FALSE);
END;
$$;

-- Grant execute to authenticated users so the policy can call it
GRANT EXECUTE ON FUNCTION public.user_owns_application(TEXT) TO authenticated;

-- =============================================
-- Replace Storage policies with tighter ones
-- =============================================

-- Drop the existing (user-folder-only) policies
DROP POLICY IF EXISTS "Users can upload own documents"  ON storage.objects;
DROP POLICY IF EXISTS "Users can view own documents"    ON storage.objects;
DROP POLICY IF EXISTS "Users can update own documents"  ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own documents"  ON storage.objects;

-- INSERT: user folder AND application ownership
CREATE POLICY "Users can upload own documents"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'documents'
        AND (storage.foldername(name))[1] = auth.uid()::text
        AND public.user_owns_application((storage.foldername(name))[2])
    );

-- SELECT
CREATE POLICY "Users can view own documents"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'documents'
        AND (storage.foldername(name))[1] = auth.uid()::text
        AND public.user_owns_application((storage.foldername(name))[2])
    );

-- UPDATE
CREATE POLICY "Users can update own documents"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'documents'
        AND (storage.foldername(name))[1] = auth.uid()::text
        AND public.user_owns_application((storage.foldername(name))[2])
    )
    WITH CHECK (
        bucket_id = 'documents'
        AND (storage.foldername(name))[1] = auth.uid()::text
        AND public.user_owns_application((storage.foldername(name))[2])
    );

-- DELETE
CREATE POLICY "Users can delete own documents"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'documents'
        AND (storage.foldername(name))[1] = auth.uid()::text
        AND public.user_owns_application((storage.foldername(name))[2])
    );

COMMENT ON FUNCTION public.user_owns_application(TEXT) IS
    'Returns TRUE if the calling authenticated user owns the job_application with the given id. Used in storage.objects RLS policies.';
