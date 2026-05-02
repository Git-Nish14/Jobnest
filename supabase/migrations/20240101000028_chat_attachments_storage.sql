-- Migration: Expand documents bucket for chat attachments
-- Adds remaining image MIME types so NESTAi file uploads aren't rejected.
-- The per-user path prefix already covers chat-attachments/{user_id}/... via
-- the existing "Users can upload own documents" policy which checks
-- (storage.foldername(name))[1] = auth.uid()::text — uploads now stored at
-- {user_id}/chat-attachments/{sessionId}/... so the first segment is the user ID.

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
    -- Documents
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
    'text/markdown',
    -- Images (all common web/mobile formats)
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif',
    'image/avif',
    'image/bmp',
    'image/tiff',
    -- Generic fallback for edge-case formats
    'application/octet-stream'
]::text[]
WHERE id = 'documents';
