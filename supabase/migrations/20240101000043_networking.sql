-- Migration 043: Networking & Referrals
-- Adds referrals table, coffee_chats table, extends contacts and job_applications.

-- ── referrals ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS referrals (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id UUID        REFERENCES job_applications(id) ON DELETE SET NULL,
  contact_id     UUID        REFERENCES contacts(id) ON DELETE SET NULL,
  status         TEXT        NOT NULL DEFAULT 'Requested'
                             CHECK (status IN ('Requested', 'Submitted', 'Pending', 'Converted')),
  referral_date  DATE,
  notes          TEXT        CHECK (char_length(notes) <= 2000),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referrals_user_id        ON referrals (user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_application_id ON referrals (application_id);
CREATE INDEX IF NOT EXISTS idx_referrals_contact_id     ON referrals (contact_id);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY referrals_select ON referrals FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY referrals_insert ON referrals FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY referrals_update ON referrals FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY referrals_delete ON referrals FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER set_referrals_updated_at
  BEFORE UPDATE ON referrals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── coffee_chats ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coffee_chats (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id       UUID        REFERENCES contacts(id) ON DELETE SET NULL,
  scheduled_at     TIMESTAMPTZ NOT NULL,
  medium           TEXT        NOT NULL DEFAULT 'Zoom'
                               CHECK (medium IN ('Zoom', 'Phone', 'In-person', 'Google Meet', 'Teams')),
  status           TEXT        NOT NULL DEFAULT 'Scheduled'
                               CHECK (status IN ('Scheduled', 'Completed', 'Cancelled', 'No-show')),
  agenda           TEXT        CHECK (char_length(agenda) <= 2000),
  notes            TEXT        CHECK (char_length(notes) <= 5000),
  follow_up_sent   BOOLEAN     NOT NULL DEFAULT FALSE,
  referral_outcome TEXT        CHECK (char_length(referral_outcome) <= 500),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coffee_chats_user_id     ON coffee_chats (user_id);
CREATE INDEX IF NOT EXISTS idx_coffee_chats_scheduled   ON coffee_chats (scheduled_at);
CREATE INDEX IF NOT EXISTS idx_coffee_chats_contact_id  ON coffee_chats (contact_id);

ALTER TABLE coffee_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY coffee_chats_select ON coffee_chats FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY coffee_chats_insert ON coffee_chats FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY coffee_chats_update ON coffee_chats FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY coffee_chats_delete ON coffee_chats FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER set_coffee_chats_updated_at
  BEFORE UPDATE ON coffee_chats
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── extend contacts ───────────────────────────────────────────────────────────
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS company          VARCHAR(255),
  ADD COLUMN IF NOT EXISTS school           VARCHAR(255),
  ADD COLUMN IF NOT EXISTS outreach_status  TEXT DEFAULT 'Not Contacted'
    CHECK (outreach_status IN (
      'Not Contacted', 'Connection Request Sent', 'Connected',
      'Message Sent', 'Replied', 'Coffee Chat Scheduled', 'Referral Requested'
    )),
  ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_contacts_outreach_status ON contacts (user_id, outreach_status);

-- ── extend job_applications ───────────────────────────────────────────────────
-- Denormalised flag maintained by trigger below — avoids JOIN on every list render.
ALTER TABLE job_applications
  ADD COLUMN IF NOT EXISTS has_referral BOOLEAN NOT NULL DEFAULT FALSE;

-- ── trigger: keep has_referral in sync ────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_application_has_referral()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.application_id IS NOT NULL THEN
      -- Only update applications owned by the same user who owns the referral.
      -- Prevents cross-user flag tampering via the SECURITY DEFINER privilege.
      UPDATE job_applications
        SET has_referral = TRUE
        WHERE id = NEW.application_id
          AND user_id = NEW.user_id;
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    -- application_id changed: recalculate the OLD application (may now have no referrals)
    -- and mark the NEW application (definitely has at least this referral).
    IF OLD.application_id IS DISTINCT FROM NEW.application_id THEN
      IF OLD.application_id IS NOT NULL THEN
        UPDATE job_applications
          SET has_referral = EXISTS (
            SELECT 1 FROM referrals WHERE application_id = OLD.application_id
          )
          WHERE id = OLD.application_id
            AND user_id = OLD.user_id;
      END IF;
      IF NEW.application_id IS NOT NULL THEN
        UPDATE job_applications
          SET has_referral = TRUE
          WHERE id = NEW.application_id
            AND user_id = NEW.user_id;
      END IF;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.application_id IS NOT NULL THEN
      UPDATE job_applications
        SET has_referral = EXISTS (
          SELECT 1 FROM referrals WHERE application_id = OLD.application_id
        )
        WHERE id = OLD.application_id
          AND user_id = OLD.user_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_referral_has_referral ON referrals;
CREATE TRIGGER trg_referral_has_referral
  AFTER INSERT OR UPDATE OF application_id OR DELETE ON referrals
  FOR EACH ROW EXECUTE FUNCTION update_application_has_referral();

-- ── explicit grants (mirrors migration 036 pattern) ───────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON referrals   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON coffee_chats TO authenticated;
