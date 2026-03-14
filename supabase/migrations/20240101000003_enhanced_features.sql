-- Migration: Enhanced Features
-- Description: Add interviews, contacts, tags, activity logs, reminders, and email templates
-- Created: Enhanced job tracking features

-- =============================================
-- CUSTOM TYPES
-- =============================================
DO $$ BEGIN
    CREATE TYPE interview_type AS ENUM (
        'Phone Screen',
        'Technical',
        'Behavioral',
        'On-site',
        'Panel',
        'Final',
        'Other'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE interview_status AS ENUM (
        'Scheduled',
        'Completed',
        'Cancelled',
        'Rescheduled',
        'No Show'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE reminder_type AS ENUM (
        'Follow Up',
        'Interview',
        'Deadline',
        'Custom'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE activity_type AS ENUM (
        'Created',
        'Status Changed',
        'Interview Scheduled',
        'Interview Completed',
        'Note Added',
        'Document Uploaded',
        'Reminder Set',
        'Contact Added',
        'Updated'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- =============================================
-- CONTACTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS contacts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    application_id UUID REFERENCES job_applications(id) ON DELETE SET NULL,

    -- Contact info
    name VARCHAR(255) NOT NULL,
    title VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    linkedin_url TEXT,

    -- Metadata
    notes TEXT,
    is_primary BOOLEAN DEFAULT FALSE,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    -- Constraints
    CONSTRAINT name_not_empty CHECK (LENGTH(TRIM(name)) > 0),
    CONSTRAINT valid_email CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT valid_linkedin CHECK (linkedin_url IS NULL OR linkedin_url ~* '^https?://(www\.)?linkedin\.com/')
);

-- =============================================
-- INTERVIEWS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS interviews (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    application_id UUID REFERENCES job_applications(id) ON DELETE CASCADE NOT NULL,

    -- Interview details
    type interview_type DEFAULT 'Phone Screen' NOT NULL,
    status interview_status DEFAULT 'Scheduled' NOT NULL,
    round INTEGER DEFAULT 1 NOT NULL,

    -- Scheduling
    scheduled_at TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER DEFAULT 60,
    timezone VARCHAR(50) DEFAULT 'UTC',

    -- Location/Meeting
    location TEXT,
    meeting_url TEXT,
    meeting_id VARCHAR(255),

    -- People
    interviewer_names TEXT[], -- Array of interviewer names

    -- Notes
    preparation_notes TEXT,
    post_interview_notes TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    -- Constraints
    CONSTRAINT valid_round CHECK (round > 0),
    CONSTRAINT valid_duration CHECK (duration_minutes > 0 AND duration_minutes <= 480),
    CONSTRAINT valid_meeting_url CHECK (meeting_url IS NULL OR meeting_url ~* '^https?://')
);

-- =============================================
-- TAGS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS tags (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

    -- Tag details
    name VARCHAR(50) NOT NULL,
    color VARCHAR(7) DEFAULT '#3B82F6' NOT NULL, -- Hex color

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    -- Constraints
    CONSTRAINT tag_name_not_empty CHECK (LENGTH(TRIM(name)) > 0),
    CONSTRAINT valid_hex_color CHECK (color ~* '^#[0-9A-Fa-f]{6}$'),
    CONSTRAINT unique_tag_per_user UNIQUE (user_id, name)
);

-- =============================================
-- APPLICATION TAGS JUNCTION TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS application_tags (
    application_id UUID REFERENCES job_applications(id) ON DELETE CASCADE NOT NULL,
    tag_id UUID REFERENCES tags(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    PRIMARY KEY (application_id, tag_id)
);

-- =============================================
-- ACTIVITY LOGS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    application_id UUID REFERENCES job_applications(id) ON DELETE CASCADE NOT NULL,

    -- Activity details
    activity_type activity_type NOT NULL,
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =============================================
-- REMINDERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS reminders (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    application_id UUID REFERENCES job_applications(id) ON DELETE CASCADE,

    -- Reminder details
    type reminder_type DEFAULT 'Custom' NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,

    -- Scheduling
    remind_at TIMESTAMPTZ NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    -- Constraints
    CONSTRAINT title_not_empty CHECK (LENGTH(TRIM(title)) > 0)
);

-- =============================================
-- EMAIL TEMPLATES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS email_templates (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

    -- Template details
    name VARCHAR(100) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    category VARCHAR(50) DEFAULT 'General',

    -- Variables supported: {{company}}, {{position}}, {{contact_name}}, {{date}}

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    -- Constraints
    CONSTRAINT template_name_not_empty CHECK (LENGTH(TRIM(name)) > 0),
    CONSTRAINT unique_template_per_user UNIQUE (user_id, name)
);

-- =============================================
-- SALARY DETAILS TABLE (for comparison)
-- =============================================
CREATE TABLE IF NOT EXISTS salary_details (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    application_id UUID REFERENCES job_applications(id) ON DELETE CASCADE NOT NULL UNIQUE,

    -- Salary info
    base_salary DECIMAL(12, 2),
    currency VARCHAR(3) DEFAULT 'USD',
    salary_type VARCHAR(20) DEFAULT 'yearly', -- yearly, monthly, hourly

    -- Additional compensation
    bonus DECIMAL(12, 2),
    equity VARCHAR(100),
    signing_bonus DECIMAL(12, 2),

    -- Benefits
    health_insurance BOOLEAN DEFAULT FALSE,
    dental_insurance BOOLEAN DEFAULT FALSE,
    vision_insurance BOOLEAN DEFAULT FALSE,
    retirement_401k BOOLEAN DEFAULT FALSE,
    retirement_match VARCHAR(50),
    pto_days INTEGER,
    remote_work VARCHAR(50), -- Full, Hybrid, On-site
    other_benefits TEXT[],

    -- Negotiation
    initial_offer DECIMAL(12, 2),
    final_offer DECIMAL(12, 2),
    negotiation_notes TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =============================================
-- INDEXES
-- =============================================

-- Contacts indexes
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_application_id ON contacts(application_id);

-- Interviews indexes
CREATE INDEX IF NOT EXISTS idx_interviews_user_id ON interviews(user_id);
CREATE INDEX IF NOT EXISTS idx_interviews_application_id ON interviews(application_id);
CREATE INDEX IF NOT EXISTS idx_interviews_scheduled_at ON interviews(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_interviews_status ON interviews(status);

-- Tags indexes
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);

-- Application tags indexes
CREATE INDEX IF NOT EXISTS idx_application_tags_application_id ON application_tags(application_id);
CREATE INDEX IF NOT EXISTS idx_application_tags_tag_id ON application_tags(tag_id);

-- Activity logs indexes
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_application_id ON activity_logs(application_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);

-- Reminders indexes
CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_application_id ON reminders(application_id);
CREATE INDEX IF NOT EXISTS idx_reminders_remind_at ON reminders(remind_at);
CREATE INDEX IF NOT EXISTS idx_reminders_is_completed ON reminders(is_completed);

-- Email templates indexes
CREATE INDEX IF NOT EXISTS idx_email_templates_user_id ON email_templates(user_id);

-- Salary details indexes
CREATE INDEX IF NOT EXISTS idx_salary_details_application_id ON salary_details(application_id);

-- =============================================
-- TRIGGERS
-- =============================================

-- Update triggers for updated_at columns
DROP TRIGGER IF EXISTS update_contacts_updated_at ON contacts;
CREATE TRIGGER update_contacts_updated_at
    BEFORE UPDATE ON contacts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_interviews_updated_at ON interviews;
CREATE TRIGGER update_interviews_updated_at
    BEFORE UPDATE ON interviews
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_reminders_updated_at ON reminders;
CREATE TRIGGER update_reminders_updated_at
    BEFORE UPDATE ON reminders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_email_templates_updated_at ON email_templates;
CREATE TRIGGER update_email_templates_updated_at
    BEFORE UPDATE ON email_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_salary_details_updated_at ON salary_details;
CREATE TRIGGER update_salary_details_updated_at
    BEFORE UPDATE ON salary_details
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- AUTO ACTIVITY LOG TRIGGER
-- =============================================
CREATE OR REPLACE FUNCTION log_application_activity()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO activity_logs (user_id, application_id, activity_type, description, metadata)
        VALUES (NEW.user_id, NEW.id, 'Created', 'Application created for ' || NEW.position || ' at ' || NEW.company, '{}');
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status != NEW.status THEN
            INSERT INTO activity_logs (user_id, application_id, activity_type, description, metadata)
            VALUES (NEW.user_id, NEW.id, 'Status Changed',
                    'Status changed from ' || OLD.status || ' to ' || NEW.status,
                    jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status));
        ELSE
            INSERT INTO activity_logs (user_id, application_id, activity_type, description, metadata)
            VALUES (NEW.user_id, NEW.id, 'Updated', 'Application details updated', '{}');
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS application_activity_trigger ON job_applications;
CREATE TRIGGER application_activity_trigger
    AFTER INSERT OR UPDATE ON job_applications
    FOR EACH ROW
    EXECUTE FUNCTION log_application_activity();

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

-- Contacts RLS
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can insert own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can update own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can delete own contacts" ON contacts;

CREATE POLICY "Users can view own contacts" ON contacts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own contacts" ON contacts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own contacts" ON contacts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own contacts" ON contacts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Interviews RLS
ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE interviews FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own interviews" ON interviews;
DROP POLICY IF EXISTS "Users can insert own interviews" ON interviews;
DROP POLICY IF EXISTS "Users can update own interviews" ON interviews;
DROP POLICY IF EXISTS "Users can delete own interviews" ON interviews;

CREATE POLICY "Users can view own interviews" ON interviews FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own interviews" ON interviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own interviews" ON interviews FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own interviews" ON interviews FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Tags RLS
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own tags" ON tags;
DROP POLICY IF EXISTS "Users can insert own tags" ON tags;
DROP POLICY IF EXISTS "Users can update own tags" ON tags;
DROP POLICY IF EXISTS "Users can delete own tags" ON tags;

CREATE POLICY "Users can view own tags" ON tags FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tags" ON tags FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tags" ON tags FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own tags" ON tags FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Application Tags RLS (based on tag ownership)
ALTER TABLE application_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_tags FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own application tags" ON application_tags;
DROP POLICY IF EXISTS "Users can insert own application tags" ON application_tags;
DROP POLICY IF EXISTS "Users can delete own application tags" ON application_tags;

CREATE POLICY "Users can view own application tags" ON application_tags FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM tags WHERE tags.id = application_tags.tag_id AND tags.user_id = auth.uid()));
CREATE POLICY "Users can insert own application tags" ON application_tags FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM tags WHERE tags.id = application_tags.tag_id AND tags.user_id = auth.uid()));
CREATE POLICY "Users can delete own application tags" ON application_tags FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM tags WHERE tags.id = application_tags.tag_id AND tags.user_id = auth.uid()));

-- Activity Logs RLS
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own activity logs" ON activity_logs;
DROP POLICY IF EXISTS "Users can insert own activity logs" ON activity_logs;

CREATE POLICY "Users can view own activity logs" ON activity_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own activity logs" ON activity_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Reminders RLS
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own reminders" ON reminders;
DROP POLICY IF EXISTS "Users can insert own reminders" ON reminders;
DROP POLICY IF EXISTS "Users can update own reminders" ON reminders;
DROP POLICY IF EXISTS "Users can delete own reminders" ON reminders;

CREATE POLICY "Users can view own reminders" ON reminders FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own reminders" ON reminders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reminders" ON reminders FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own reminders" ON reminders FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Email Templates RLS
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own email templates" ON email_templates;
DROP POLICY IF EXISTS "Users can insert own email templates" ON email_templates;
DROP POLICY IF EXISTS "Users can update own email templates" ON email_templates;
DROP POLICY IF EXISTS "Users can delete own email templates" ON email_templates;

CREATE POLICY "Users can view own email templates" ON email_templates FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own email templates" ON email_templates FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own email templates" ON email_templates FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own email templates" ON email_templates FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Salary Details RLS
ALTER TABLE salary_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_details FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own salary details" ON salary_details;
DROP POLICY IF EXISTS "Users can insert own salary details" ON salary_details;
DROP POLICY IF EXISTS "Users can update own salary details" ON salary_details;
DROP POLICY IF EXISTS "Users can delete own salary details" ON salary_details;

CREATE POLICY "Users can view own salary details" ON salary_details FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM job_applications WHERE job_applications.id = salary_details.application_id AND job_applications.user_id = auth.uid()));
CREATE POLICY "Users can insert own salary details" ON salary_details FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM job_applications WHERE job_applications.id = salary_details.application_id AND job_applications.user_id = auth.uid()));
CREATE POLICY "Users can update own salary details" ON salary_details FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM job_applications WHERE job_applications.id = salary_details.application_id AND job_applications.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM job_applications WHERE job_applications.id = salary_details.application_id AND job_applications.user_id = auth.uid()));
CREATE POLICY "Users can delete own salary details" ON salary_details FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM job_applications WHERE job_applications.id = salary_details.application_id AND job_applications.user_id = auth.uid()));

-- =============================================
-- DEFAULT EMAIL TEMPLATES FUNCTION
-- =============================================
CREATE OR REPLACE FUNCTION create_default_email_templates()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO email_templates (user_id, name, subject, body, category) VALUES
    (NEW.id, 'Follow Up', 'Following up on {{position}} application',
     'Hi {{contact_name}},

I hope this email finds you well. I wanted to follow up on my application for the {{position}} position at {{company}} that I submitted on {{date}}.

I remain very interested in this opportunity and would welcome the chance to discuss how my skills and experience align with your needs.

Please let me know if you need any additional information from me.

Best regards', 'Follow Up'),

    (NEW.id, 'Thank You - Interview', 'Thank you for the interview - {{position}}',
     'Dear {{contact_name}},

Thank you for taking the time to meet with me today regarding the {{position}} position at {{company}}.

I enjoyed learning more about the role and the team. Our conversation reinforced my enthusiasm for this opportunity.

I look forward to hearing from you about the next steps.

Best regards', 'Thank You'),

    (NEW.id, 'Acceptance', 'Accepting offer for {{position}}',
     'Dear {{contact_name}},

I am thrilled to formally accept the offer for the {{position}} position at {{company}}.

I am excited to join the team and contribute to the company''s success. Please let me know the next steps for onboarding.

Thank you for this opportunity.

Best regards', 'Offer');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: You may want to create a trigger on auth.users to auto-create templates
-- This requires superuser privileges in Supabase

-- =============================================
-- COMMENTS
-- =============================================
COMMENT ON TABLE contacts IS 'Stores contact information for recruiters and hiring managers';
COMMENT ON TABLE interviews IS 'Tracks interview rounds and scheduling';
COMMENT ON TABLE tags IS 'User-defined tags for organizing applications';
COMMENT ON TABLE application_tags IS 'Junction table linking applications to tags';
COMMENT ON TABLE activity_logs IS 'Audit trail of all application activities';
COMMENT ON TABLE reminders IS 'User reminders for follow-ups and deadlines';
COMMENT ON TABLE email_templates IS 'Reusable email templates for job search communications';
COMMENT ON TABLE salary_details IS 'Detailed salary and benefits information for offers';
