-- Migration: Pin chat sessions
-- Adds is_pinned boolean to chat_sessions so users can pin important conversations

ALTER TABLE chat_sessions
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE;

-- Partial index — only non-zero rows, keeps the index tiny
CREATE INDEX IF NOT EXISTS idx_chat_sessions_pinned
  ON chat_sessions(user_id, updated_at DESC)
  WHERE is_pinned = TRUE;

COMMENT ON COLUMN chat_sessions.is_pinned IS 'When true the session is shown pinned at the top of the sidebar';
