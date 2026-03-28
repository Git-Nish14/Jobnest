-- Migration: Fix Auth RLS Initialization Plan warnings
-- Description: Replaces auth.uid() with (select auth.uid()) in every RLS policy so that
--              Postgres evaluates the current user's ID once per query (init plan) rather
--              than once per row, eliminating the Supabase Performance Advisor warning.

-- =============================================
-- job_applications
-- =============================================
DROP POLICY IF EXISTS "Users can view own applications" ON job_applications;
DROP POLICY IF EXISTS "Users can insert own applications" ON job_applications;
DROP POLICY IF EXISTS "Users can update own applications" ON job_applications;
DROP POLICY IF EXISTS "Users can delete own applications" ON job_applications;

CREATE POLICY "Users can view own applications" ON job_applications
    FOR SELECT TO authenticated
    USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own applications" ON job_applications
    FOR INSERT TO authenticated
    WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own applications" ON job_applications
    FOR UPDATE TO authenticated
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own applications" ON job_applications
    FOR DELETE TO authenticated
    USING ((select auth.uid()) = user_id);

-- =============================================
-- contacts
-- =============================================
DROP POLICY IF EXISTS "Users can view own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can insert own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can update own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can delete own contacts" ON contacts;

CREATE POLICY "Users can view own contacts" ON contacts
    FOR SELECT TO authenticated
    USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own contacts" ON contacts
    FOR INSERT TO authenticated
    WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own contacts" ON contacts
    FOR UPDATE TO authenticated
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own contacts" ON contacts
    FOR DELETE TO authenticated
    USING ((select auth.uid()) = user_id);

-- =============================================
-- interviews
-- =============================================
DROP POLICY IF EXISTS "Users can view own interviews" ON interviews;
DROP POLICY IF EXISTS "Users can insert own interviews" ON interviews;
DROP POLICY IF EXISTS "Users can update own interviews" ON interviews;
DROP POLICY IF EXISTS "Users can delete own interviews" ON interviews;

CREATE POLICY "Users can view own interviews" ON interviews
    FOR SELECT TO authenticated
    USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own interviews" ON interviews
    FOR INSERT TO authenticated
    WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own interviews" ON interviews
    FOR UPDATE TO authenticated
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own interviews" ON interviews
    FOR DELETE TO authenticated
    USING ((select auth.uid()) = user_id);

-- =============================================
-- tags
-- =============================================
DROP POLICY IF EXISTS "Users can view own tags" ON tags;
DROP POLICY IF EXISTS "Users can insert own tags" ON tags;
DROP POLICY IF EXISTS "Users can update own tags" ON tags;
DROP POLICY IF EXISTS "Users can delete own tags" ON tags;

CREATE POLICY "Users can view own tags" ON tags
    FOR SELECT TO authenticated
    USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own tags" ON tags
    FOR INSERT TO authenticated
    WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own tags" ON tags
    FOR UPDATE TO authenticated
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own tags" ON tags
    FOR DELETE TO authenticated
    USING ((select auth.uid()) = user_id);

-- =============================================
-- application_tags (ownership via tags join)
-- =============================================
DROP POLICY IF EXISTS "Users can view own application tags" ON application_tags;
DROP POLICY IF EXISTS "Users can insert own application tags" ON application_tags;
DROP POLICY IF EXISTS "Users can delete own application tags" ON application_tags;

CREATE POLICY "Users can view own application tags" ON application_tags
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM tags
        WHERE tags.id = application_tags.tag_id
          AND tags.user_id = (select auth.uid())
    ));

CREATE POLICY "Users can insert own application tags" ON application_tags
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (
        SELECT 1 FROM tags
        WHERE tags.id = application_tags.tag_id
          AND tags.user_id = (select auth.uid())
    ));

CREATE POLICY "Users can delete own application tags" ON application_tags
    FOR DELETE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM tags
        WHERE tags.id = application_tags.tag_id
          AND tags.user_id = (select auth.uid())
    ));

-- =============================================
-- activity_logs
-- =============================================
DROP POLICY IF EXISTS "Users can view own activity logs" ON activity_logs;
DROP POLICY IF EXISTS "Users can insert own activity logs" ON activity_logs;

CREATE POLICY "Users can view own activity logs" ON activity_logs
    FOR SELECT TO authenticated
    USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own activity logs" ON activity_logs
    FOR INSERT TO authenticated
    WITH CHECK ((select auth.uid()) = user_id);

-- =============================================
-- reminders
-- =============================================
DROP POLICY IF EXISTS "Users can view own reminders" ON reminders;
DROP POLICY IF EXISTS "Users can insert own reminders" ON reminders;
DROP POLICY IF EXISTS "Users can update own reminders" ON reminders;
DROP POLICY IF EXISTS "Users can delete own reminders" ON reminders;

CREATE POLICY "Users can view own reminders" ON reminders
    FOR SELECT TO authenticated
    USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own reminders" ON reminders
    FOR INSERT TO authenticated
    WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own reminders" ON reminders
    FOR UPDATE TO authenticated
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own reminders" ON reminders
    FOR DELETE TO authenticated
    USING ((select auth.uid()) = user_id);

-- =============================================
-- email_templates
-- =============================================
DROP POLICY IF EXISTS "Users can view own email templates" ON email_templates;
DROP POLICY IF EXISTS "Users can insert own email templates" ON email_templates;
DROP POLICY IF EXISTS "Users can update own email templates" ON email_templates;
DROP POLICY IF EXISTS "Users can delete own email templates" ON email_templates;

CREATE POLICY "Users can view own email templates" ON email_templates
    FOR SELECT TO authenticated
    USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own email templates" ON email_templates
    FOR INSERT TO authenticated
    WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own email templates" ON email_templates
    FOR UPDATE TO authenticated
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own email templates" ON email_templates
    FOR DELETE TO authenticated
    USING ((select auth.uid()) = user_id);

-- =============================================
-- salary_details (ownership via job_applications join)
-- =============================================
DROP POLICY IF EXISTS "Users can view own salary details" ON salary_details;
DROP POLICY IF EXISTS "Users can insert own salary details" ON salary_details;
DROP POLICY IF EXISTS "Users can update own salary details" ON salary_details;
DROP POLICY IF EXISTS "Users can delete own salary details" ON salary_details;

CREATE POLICY "Users can view own salary details" ON salary_details
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM job_applications
        WHERE job_applications.id = salary_details.application_id
          AND job_applications.user_id = (select auth.uid())
    ));

CREATE POLICY "Users can insert own salary details" ON salary_details
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (
        SELECT 1 FROM job_applications
        WHERE job_applications.id = salary_details.application_id
          AND job_applications.user_id = (select auth.uid())
    ));

CREATE POLICY "Users can update own salary details" ON salary_details
    FOR UPDATE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM job_applications
        WHERE job_applications.id = salary_details.application_id
          AND job_applications.user_id = (select auth.uid())
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM job_applications
        WHERE job_applications.id = salary_details.application_id
          AND job_applications.user_id = (select auth.uid())
    ));

CREATE POLICY "Users can delete own salary details" ON salary_details
    FOR DELETE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM job_applications
        WHERE job_applications.id = salary_details.application_id
          AND job_applications.user_id = (select auth.uid())
    ));

-- =============================================
-- chat_sessions
-- =============================================
DROP POLICY IF EXISTS "Users can view own chat sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Users can insert own chat sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Users can update own chat sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Users can delete own chat sessions" ON chat_sessions;

CREATE POLICY "Users can view own chat sessions" ON chat_sessions
    FOR SELECT TO authenticated
    USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own chat sessions" ON chat_sessions
    FOR INSERT TO authenticated
    WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own chat sessions" ON chat_sessions
    FOR UPDATE TO authenticated
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own chat sessions" ON chat_sessions
    FOR DELETE TO authenticated
    USING ((select auth.uid()) = user_id);

-- =============================================
-- chat_messages
-- =============================================
DROP POLICY IF EXISTS "Users can view own chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can insert own chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can delete own chat messages" ON chat_messages;

CREATE POLICY "Users can view own chat messages" ON chat_messages
    FOR SELECT TO authenticated
    USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own chat messages" ON chat_messages
    FOR INSERT TO authenticated
    WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own chat messages" ON chat_messages
    FOR DELETE TO authenticated
    USING ((select auth.uid()) = user_id);

-- =============================================
-- subscriptions
-- =============================================
DROP POLICY IF EXISTS "users_view_own_subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "service_role_manage_subscriptions" ON public.subscriptions;

CREATE POLICY "users_view_own_subscription" ON public.subscriptions
    FOR SELECT
    USING ((select auth.uid()) = user_id);

CREATE POLICY "service_role_manage_subscriptions" ON public.subscriptions
    FOR ALL
    USING ((select auth.role()) = 'service_role');

-- =============================================
-- rate_limits
-- =============================================
DROP POLICY IF EXISTS "Users can view own rate limits" ON rate_limits;

CREATE POLICY "Users can view own rate limits" ON rate_limits
    FOR SELECT
    USING (user_id = (select auth.uid()));
