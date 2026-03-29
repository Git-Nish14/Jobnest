-- Migration 16: Application Documents — versioned document storage
-- Replaces the two hard-coded columns (resume_path, cover_letter_path) on job_applications
-- with a flexible join table supporting multiple document types, custom labels, and version history.

-- =============================================
-- application_documents
-- =============================================
CREATE TABLE IF NOT EXISTS application_documents (
    id              UUID        DEFAULT uuid_generate_v4() PRIMARY KEY,
    application_id  UUID        REFERENCES job_applications(id) ON DELETE CASCADE,
    user_id         UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

    -- Label: "Resume", "Cover Letter", or any custom name (≤80 chars)
    label           VARCHAR(80) NOT NULL,

    -- Storage path: {user_id}/{application_id}/{label}/{timestamp}_{filename}
    -- For master-library docs (no application): {user_id}/library/{label}/{timestamp}_{filename}
    storage_path    TEXT        NOT NULL UNIQUE,

    mime_type       TEXT        NOT NULL,
    size_bytes      BIGINT      NOT NULL CHECK (size_bytes > 0),

    -- Version management: only one row per (application_id, user_id, label) can be current
    is_current      BOOLEAN     NOT NULL DEFAULT TRUE,

    -- Master library: user-level templates not tied to a specific application
    is_master       BOOLEAN     NOT NULL DEFAULT FALSE,

    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Derived filename for display (e.g. "senior_dev_resume_v3.pdf")
    original_name   VARCHAR(255),

    -- If application_id is NULL the document is a master-library item
    CONSTRAINT doc_has_application_or_is_master CHECK (
        (application_id IS NOT NULL AND is_master = FALSE)
        OR (application_id IS NULL AND is_master = TRUE)
    )
);

-- =============================================
-- document_shared_links
-- =============================================
CREATE TABLE IF NOT EXISTS document_shared_links (
    id          UUID        DEFAULT uuid_generate_v4() PRIMARY KEY,
    document_id UUID        REFERENCES application_documents(id) ON DELETE CASCADE NOT NULL,
    user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

    -- Random token used in the public URL
    token       TEXT        NOT NULL UNIQUE,

    -- When the link expires (user-chosen: 1d / 7d / 30d)
    expires_at  TIMESTAMPTZ NOT NULL,

    -- Track how many times the link was accessed
    view_count  INTEGER     NOT NULL DEFAULT 0,

    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_app_docs_user
    ON application_documents(user_id);

CREATE INDEX IF NOT EXISTS idx_app_docs_application
    ON application_documents(application_id)
    WHERE application_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_app_docs_user_label
    ON application_documents(user_id, label);

CREATE INDEX IF NOT EXISTS idx_app_docs_current
    ON application_documents(application_id, label, is_current)
    WHERE is_current = TRUE;

CREATE INDEX IF NOT EXISTS idx_doc_shared_links_token
    ON document_shared_links(token);

CREATE INDEX IF NOT EXISTS idx_doc_shared_links_expires
    ON document_shared_links(expires_at);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
ALTER TABLE application_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_documents FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own documents"   ON application_documents;
DROP POLICY IF EXISTS "Users can insert own documents" ON application_documents;
DROP POLICY IF EXISTS "Users can update own documents" ON application_documents;
DROP POLICY IF EXISTS "Users can delete own documents" ON application_documents;

CREATE POLICY "Users can view own documents"
    ON application_documents FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own documents"
    ON application_documents FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own documents"
    ON application_documents FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own documents"
    ON application_documents FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Shared links: only the owning user can manage their links
ALTER TABLE document_shared_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_shared_links FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own shared links"   ON document_shared_links;
DROP POLICY IF EXISTS "Users can insert own shared links" ON document_shared_links;
DROP POLICY IF EXISTS "Users can update own shared links" ON document_shared_links;
DROP POLICY IF EXISTS "Users can delete own shared links" ON document_shared_links;

CREATE POLICY "Users can view own shared links"
    ON document_shared_links FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own shared links"
    ON document_shared_links FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own shared links"
    ON document_shared_links FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own shared links"
    ON document_shared_links FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- =============================================
-- COMMENTS
-- =============================================
COMMENT ON TABLE application_documents IS
    'Versioned document storage for job applications and master library. Each upload is a new row; is_current marks the active version.';
COMMENT ON TABLE document_shared_links IS
    'Time-limited public share links for individual documents. Token is random and verified server-side.';
COMMENT ON COLUMN application_documents.storage_path IS
    'Full path in Supabase Storage documents bucket. Format: {user_id}/{app_id}/{label}/{timestamp}_{filename}';
COMMENT ON COLUMN application_documents.is_current IS
    'TRUE for the active version. Only one row per (application_id, label) should be current at a time.';
COMMENT ON COLUMN application_documents.is_master IS
    'TRUE for master-library documents not tied to a specific application (application_id will be NULL).';
