-- Migration 17: Expand storage bucket MIME types and increase file-size limit
-- Adds support for DOCX, TXT, MD, PNG, JPEG alongside the existing PDF.
-- Increases limit from 5 MB → 10 MB to accommodate images and larger DOCX files.

UPDATE storage.buckets
SET
    file_size_limit   = 10485760,   -- 10 MB
    allowed_mime_types = ARRAY[
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',  -- .docx
        'application/msword',                                                        -- .doc
        'text/plain',
        'text/markdown',
        'image/png',
        'image/jpeg'
    ]::text[]
WHERE id = 'documents';
