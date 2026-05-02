-- Migration 29: Allow chat-attachments as a valid storage path prefix
-- The user_owns_application() function (from migration 18) validates the second
-- path segment in storage RLS policies. It already allows 'library' for the
-- document library. This extends it to also allow 'chat-attachments' so that
-- NESTAi file uploads stored at {user_id}/chat-attachments/{sessionId}/...
-- pass the RLS check without requiring a valid application UUID.

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
    -- Allow known non-application path prefixes
    IF p_app_id IN ('library', 'chat-attachments') THEN
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

COMMENT ON FUNCTION public.user_owns_application(TEXT) IS
    'Returns TRUE if the caller owns the job_application with the given id, or if the segment is a known non-application prefix (library, chat-attachments).';
