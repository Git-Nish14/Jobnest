-- Migration: Add metadata to chat_messages
-- Stores attachment info (filename, type) so file cards can be re-rendered on session load

ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS metadata JSONB NULL;

COMMENT ON COLUMN chat_messages.metadata IS 'Optional JSON payload, e.g. { "attachment": { "name": "resume.pdf", "fileType": "pdf" } }';
