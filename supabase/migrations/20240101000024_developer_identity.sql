-- Migration: developer identity — skills, certifications, education
-- These tables power the new Profile sections added in Day 12.
-- All tables enforce RLS: each user can only see and modify their own rows.

-- ── Skills ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS skills (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name        TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
    category    TEXT        NOT NULL DEFAULT 'Language'
                            CHECK (category IN ('Language','Framework','Database','Cloud','Tool','Soft')),
    proficiency TEXT        NOT NULL DEFAULT 'Intermediate'
                            CHECK (proficiency IN ('Beginner','Intermediate','Advanced','Expert')),
    years_experience SMALLINT CHECK (years_experience BETWEEN 0 AND 50),
    last_used_at DATE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS skills_user_id_idx ON skills (user_id);
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "skills_owner" ON skills USING (user_id = auth.uid());

-- ── Certifications ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS certifications (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name            TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
    provider        TEXT,
    credential_id   TEXT,
    credential_url  TEXT,
    issued_at       DATE        NOT NULL,
    expires_at      DATE,
    -- expires_at must be after issued_at when both are set
    CONSTRAINT cert_dates_valid CHECK (expires_at IS NULL OR expires_at > issued_at),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS certifications_user_id_idx ON certifications (user_id);
ALTER TABLE certifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "certifications_owner" ON certifications USING (user_id = auth.uid());

-- ── Education ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS education (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    institution     TEXT        NOT NULL CHECK (char_length(institution) BETWEEN 1 AND 120),
    degree          TEXT        NOT NULL DEFAULT 'BS'
                                CHECK (degree IN ('BS','MS','PhD','MBA','Associate','Bootcamp','Certificate','Self-taught','Other')),
    field_of_study  TEXT,
    gpa             NUMERIC(3,2) CHECK (gpa BETWEEN 0 AND 4.0),
    show_gpa        BOOLEAN     NOT NULL DEFAULT FALSE,
    start_date      DATE        NOT NULL,
    end_date        DATE,
    is_current      BOOLEAN     NOT NULL DEFAULT FALSE,
    activities      TEXT[]      DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS education_user_id_idx ON education (user_id);
ALTER TABLE education ENABLE ROW LEVEL SECURITY;
CREATE POLICY "education_owner" ON education USING (user_id = auth.uid());

-- ── Shared updated_at trigger ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER skills_updated_at        BEFORE UPDATE ON skills        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE OR REPLACE TRIGGER certifications_updated_at BEFORE UPDATE ON certifications FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE OR REPLACE TRIGGER education_updated_at      BEFORE UPDATE ON education      FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE skills         IS 'User skill inventory — category/proficiency/recency for ATS match and profile.';
COMMENT ON TABLE certifications IS 'Professional certifications with optional expiry reminders.';
COMMENT ON TABLE education      IS 'Educational history — degree, institution, GPA (opt-in display).';
