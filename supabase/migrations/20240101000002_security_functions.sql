-- Migration: Security Functions
-- Description: Helper functions for enhanced security and auditing
-- Created: Initial setup

-- =============================================
-- SECURITY FUNCTIONS
-- =============================================

-- Function to check if user owns an application
CREATE OR REPLACE FUNCTION user_owns_application(app_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM job_applications
        WHERE id = app_id AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's application count
CREATE OR REPLACE FUNCTION get_user_application_count()
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INTEGER FROM job_applications
        WHERE user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's application stats
CREATE OR REPLACE FUNCTION get_user_application_stats()
RETURNS TABLE (
    total_count INTEGER,
    applied_count INTEGER,
    phone_screen_count INTEGER,
    interview_count INTEGER,
    offer_count INTEGER,
    rejected_count INTEGER,
    this_week_count INTEGER,
    this_month_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::INTEGER as total_count,
        COUNT(*) FILTER (WHERE status = 'Applied')::INTEGER as applied_count,
        COUNT(*) FILTER (WHERE status = 'Phone Screen')::INTEGER as phone_screen_count,
        COUNT(*) FILTER (WHERE status = 'Interview')::INTEGER as interview_count,
        COUNT(*) FILTER (WHERE status = 'Offer')::INTEGER as offer_count,
        COUNT(*) FILTER (WHERE status = 'Rejected')::INTEGER as rejected_count,
        COUNT(*) FILTER (WHERE applied_date >= date_trunc('week', CURRENT_DATE))::INTEGER as this_week_count,
        COUNT(*) FILTER (WHERE applied_date >= date_trunc('month', CURRENT_DATE))::INTEGER as this_month_count
    FROM job_applications
    WHERE user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- RATE LIMITING (Optional - for production)
-- =============================================

-- Create table for rate limiting (optional)
CREATE TABLE IF NOT EXISTS rate_limits (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    action VARCHAR(50) NOT NULL,
    count INTEGER DEFAULT 1,
    window_start TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, action)
);

-- Enable RLS on rate_limits
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Function to check rate limit (100 applications per day)
CREATE OR REPLACE FUNCTION check_application_rate_limit()
RETURNS BOOLEAN AS $$
DECLARE
    daily_count INTEGER;
    max_daily_limit INTEGER := 100;
BEGIN
    SELECT COUNT(*) INTO daily_count
    FROM job_applications
    WHERE user_id = auth.uid()
    AND created_at >= CURRENT_DATE;

    RETURN daily_count < max_daily_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- CLEANUP FUNCTIONS
-- =============================================

-- Function to delete orphaned storage files
-- Should be called periodically via a scheduled job
CREATE OR REPLACE FUNCTION cleanup_orphaned_files()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    -- This is a placeholder - actual implementation would need
    -- to integrate with Supabase Storage API
    -- Called via Edge Function or external cron job
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
