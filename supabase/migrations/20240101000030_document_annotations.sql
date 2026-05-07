-- Migration 30: Document Annotations — sticky notes on PDF pages
-- Each annotation is positioned via relative coordinates (x_pct, y_pct) so it
-- renders correctly regardless of viewer zoom level or viewport size.

CREATE TABLE document_annotations (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  UUID        NOT NULL REFERENCES application_documents(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES auth.users(id)            ON DELETE CASCADE,
  page_number  INT         NOT NULL CHECK (page_number >= 1),
  x_pct        FLOAT       NOT NULL CHECK (x_pct BETWEEN 0 AND 1),
  y_pct        FLOAT       NOT NULL CHECK (y_pct BETWEEN 0 AND 1),
  width_pct    FLOAT       NOT NULL DEFAULT 0.22 CHECK (width_pct BETWEEN 0.05 AND 0.6),
  content      TEXT        NOT NULL DEFAULT '',
  color        VARCHAR(7)  NOT NULL DEFAULT '#fef08a',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: users can only see and manage their own annotations
ALTER TABLE document_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_annotations FORCE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own annotations"
  ON document_annotations
  FOR ALL
  TO authenticated
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_annotations_document ON document_annotations(document_id);
CREATE INDEX idx_annotations_user     ON document_annotations(user_id);

COMMENT ON TABLE document_annotations IS
  'Sticky-note annotations on PDF documents. Positions stored as 0–1 fractions of page dimensions.';
COMMENT ON COLUMN document_annotations.x_pct IS
  'Left edge of the note as a fraction of page width (0 = left, 1 = right).';
COMMENT ON COLUMN document_annotations.y_pct IS
  'Top edge of the note as a fraction of page height (0 = top, 1 = bottom).';
COMMENT ON COLUMN document_annotations.color IS
  'Hex colour of the note header bar. Presets: #fef08a yellow, #fbcfe8 pink, #bfdbfe blue, #bbf7d0 green, #e9d5ff purple.';
