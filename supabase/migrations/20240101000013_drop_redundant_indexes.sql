-- Migration: Drop redundant indexes
-- Description: Removes single-column indexes that are already covered by composite indexes,
--              and removes indexes for columns that have no corresponding query pattern.
--              These were flagged by Supabase's Performance Advisor (idx_scan = 0).

-- Covered by idx_chat_sessions_user_updated(user_id, updated_at DESC)
DROP INDEX IF EXISTS public.idx_chat_sessions_user_id;

-- Covered by idx_job_applications_user_status(user_id, status)
-- and idx_job_applications_user_date(user_id, applied_date DESC)
DROP INDEX IF EXISTS public.idx_job_applications_user_id;

-- No company-search feature exists; all job_applications queries filter by user_id first
DROP INDEX IF EXISTS public.idx_job_applications_company;

-- OTP lookup queries filter by (email, used, expires_at); covered by idx_otp_codes_email_used_expires
DROP INDEX IF EXISTS public.idx_otp_codes_email_purpose;
