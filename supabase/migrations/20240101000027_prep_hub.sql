-- Migration: Technical Interview Prep Hub
-- Tables: coding_problems, assessments, behavioral_answers, mock_interviews,
--         interview_questions, prep_streaks

-- ── coding_problems ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coding_problems (
    id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title        TEXT NOT NULL,
    url          TEXT,
    difficulty   TEXT NOT NULL DEFAULT 'Medium'
                   CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
    topic        TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'Todo'
                   CHECK (status IN ('Todo', 'Attempted', 'Solved', 'Review')),
    company_tags TEXT[]    DEFAULT '{}' NOT NULL,
    time_to_solve_minutes INT,
    notes        TEXT,
    solution_url TEXT,
    last_reviewed_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_coding_problems_user_id
    ON coding_problems(user_id);
CREATE INDEX IF NOT EXISTS idx_coding_problems_status
    ON coding_problems(user_id, status);
CREATE INDEX IF NOT EXISTS idx_coding_problems_topic
    ON coding_problems(user_id, topic);

ALTER TABLE coding_problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE coding_problems FORCE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own coding problems"
    ON coding_problems FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ── assessments (take-home / coding challenge tracker) ────────────────────────
CREATE TABLE IF NOT EXISTS assessments (
    id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    application_id UUID REFERENCES job_applications(id) ON DELETE SET NULL,
    title          TEXT NOT NULL,
    platform       TEXT,
    assigned_at    TIMESTAMPTZ,
    deadline       TIMESTAMPTZ,
    time_limit_hours NUMERIC,
    tech_stack     TEXT[]    DEFAULT '{}' NOT NULL,
    status         TEXT NOT NULL DEFAULT 'Pending'
                     CHECK (status IN ('Pending', 'In Progress', 'Submitted', 'Passed', 'Failed')),
    score          NUMERIC,
    feedback       TEXT,
    time_spent_minutes INT,
    created_at     TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at     TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assessments_user_id
    ON assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_assessments_deadline
    ON assessments(user_id, deadline);

ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments FORCE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own assessments"
    ON assessments FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ── behavioral_answers (STAR method) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS behavioral_answers (
    id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    question     TEXT NOT NULL,
    competency   TEXT CHECK (competency IN (
                   'Leadership', 'Conflict', 'Failure', 'Achievement',
                   'Teamwork', 'Communication', 'Problem Solving', 'Other')),
    situation    TEXT,
    task_desc    TEXT,
    action       TEXT,
    result       TEXT,
    last_updated TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_behavioral_answers_user_id
    ON behavioral_answers(user_id);

ALTER TABLE behavioral_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE behavioral_answers FORCE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own behavioral answers"
    ON behavioral_answers FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ── mock_interviews ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mock_interviews (
    id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    scheduled_at      TIMESTAMPTZ NOT NULL,
    type              TEXT NOT NULL
                        CHECK (type IN ('DSA', 'Behavioral', 'System Design', 'Mixed')),
    status            TEXT NOT NULL DEFAULT 'Scheduled'
                        CHECK (status IN ('Scheduled', 'Completed', 'Cancelled')),
    partner_name      TEXT,
    score             SMALLINT CHECK (score BETWEEN 1 AND 5),
    feedback          TEXT,
    topics_to_revisit TEXT[] DEFAULT '{}' NOT NULL,
    created_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mock_interviews_user_id
    ON mock_interviews(user_id);
CREATE INDEX IF NOT EXISTS idx_mock_interviews_scheduled
    ON mock_interviews(user_id, scheduled_at);

ALTER TABLE mock_interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE mock_interviews FORCE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own mock interviews"
    ON mock_interviews FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ── interview_questions (questions logged from real interviews) ───────────────
CREATE TABLE IF NOT EXISTS interview_questions (
    id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
    question     TEXT NOT NULL,
    category     TEXT CHECK (category IN (
                   'DSA', 'Behavioral', 'System Design',
                   'Domain Knowledge', 'Culture Fit', 'Other')),
    difficulty   TEXT CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
    notes        TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_interview_questions_user_id
    ON interview_questions(user_id);
CREATE INDEX IF NOT EXISTS idx_interview_questions_interview_id
    ON interview_questions(interview_id);

ALTER TABLE interview_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_questions FORCE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own interview questions"
    ON interview_questions FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ── prep_streaks (one row per user, upserted) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS prep_streaks (
    user_id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    current_streak         INT  DEFAULT 0 NOT NULL,
    longest_streak         INT  DEFAULT 0 NOT NULL,
    last_activity_date     DATE,
    -- JSONB map: topic_key -> 'Not Started' | 'Reading' | 'Comfortable'
    system_design_progress JSONB DEFAULT '{}' NOT NULL,
    created_at             TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at             TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE prep_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE prep_streaks FORCE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own prep streak"
    ON prep_streaks FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ── Comments ──────────────────────────────────────────────────────────────────
COMMENT ON TABLE coding_problems     IS 'LeetCode / DSA problem tracker with spaced-repetition Review queue';
COMMENT ON TABLE assessments         IS 'Take-home and coding-challenge assessment tracker';
COMMENT ON TABLE behavioral_answers  IS 'STAR-format behavioral interview answer bank';
COMMENT ON TABLE mock_interviews     IS 'Mock interview scheduler and post-session notes';
COMMENT ON TABLE interview_questions IS 'Questions logged after real interview sessions';
COMMENT ON TABLE prep_streaks        IS 'Per-user daily prep streak and system design checklist progress';
