-- Fix auth_rls_initplan warnings for all tables added after migration 000014.
-- Wraps auth.uid() in (select auth.uid()) so Postgres evaluates it once per
-- query rather than once per row, matching the pattern established in 000014.

-- ── activity_logs ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own activity logs"   ON activity_logs;
DROP POLICY IF EXISTS "Users can insert own activity logs" ON activity_logs;

CREATE POLICY "Users can view own activity logs"
    ON activity_logs FOR SELECT TO authenticated
    USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own activity logs"
    ON activity_logs FOR INSERT TO authenticated
    WITH CHECK ((select auth.uid()) = user_id);

-- ── application_documents ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own documents"   ON application_documents;
DROP POLICY IF EXISTS "Users can insert own documents" ON application_documents;
DROP POLICY IF EXISTS "Users can update own documents" ON application_documents;
DROP POLICY IF EXISTS "Users can delete own documents" ON application_documents;

CREATE POLICY "Users can view own documents"
    ON application_documents FOR SELECT TO authenticated
    USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own documents"
    ON application_documents FOR INSERT TO authenticated
    WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own documents"
    ON application_documents FOR UPDATE TO authenticated
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own documents"
    ON application_documents FOR DELETE TO authenticated
    USING ((select auth.uid()) = user_id);

-- ── document_shared_links ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own shared links"   ON document_shared_links;
DROP POLICY IF EXISTS "Users can insert own shared links" ON document_shared_links;
DROP POLICY IF EXISTS "Users can update own shared links" ON document_shared_links;
DROP POLICY IF EXISTS "Users can delete own shared links" ON document_shared_links;

CREATE POLICY "Users can view own shared links"
    ON document_shared_links FOR SELECT TO authenticated
    USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own shared links"
    ON document_shared_links FOR INSERT TO authenticated
    WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own shared links"
    ON document_shared_links FOR UPDATE TO authenticated
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own shared links"
    ON document_shared_links FOR DELETE TO authenticated
    USING ((select auth.uid()) = user_id);

-- ── notifications ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "notifications_select" ON notifications;
DROP POLICY IF EXISTS "notifications_update" ON notifications;
DROP POLICY IF EXISTS "notifications_delete" ON notifications;

CREATE POLICY "notifications_select"
    ON notifications FOR SELECT
    USING ((select auth.uid()) = user_id);

CREATE POLICY "notifications_update"
    ON notifications FOR UPDATE
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "notifications_delete"
    ON notifications FOR DELETE
    USING ((select auth.uid()) = user_id);

-- ── skills / certifications / education ───────────────────────────────────────
DROP POLICY IF EXISTS "skills_owner"         ON skills;
DROP POLICY IF EXISTS "certifications_owner" ON certifications;
DROP POLICY IF EXISTS "education_owner"      ON education;

CREATE POLICY "skills_owner"         ON skills         USING (user_id = (select auth.uid()));
CREATE POLICY "certifications_owner" ON certifications USING (user_id = (select auth.uid()));
CREATE POLICY "education_owner"      ON education      USING (user_id = (select auth.uid()));

-- ── prep hub tables ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can manage own coding problems"     ON coding_problems;
DROP POLICY IF EXISTS "Users can manage own assessments"         ON assessments;
DROP POLICY IF EXISTS "Users can manage own behavioral answers"  ON behavioral_answers;
DROP POLICY IF EXISTS "Users can manage own mock interviews"     ON mock_interviews;
DROP POLICY IF EXISTS "Users can manage own interview questions" ON interview_questions;
DROP POLICY IF EXISTS "Users can manage own prep streak"         ON prep_streaks;

CREATE POLICY "Users can manage own coding problems"
    ON coding_problems FOR ALL
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can manage own assessments"
    ON assessments FOR ALL
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can manage own behavioral answers"
    ON behavioral_answers FOR ALL
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can manage own mock interviews"
    ON mock_interviews FOR ALL
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can manage own interview questions"
    ON interview_questions FOR ALL
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can manage own prep streak"
    ON prep_streaks FOR ALL
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

-- ── document_annotations ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users manage own annotations" ON document_annotations;

CREATE POLICY "Users manage own annotations"
  ON document_annotations FOR ALL TO authenticated
  USING  ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ── portfolio tables ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "github_connections_select_own"  ON github_connections;
DROP POLICY IF EXISTS "github_connections_delete_own"  ON github_connections;
DROP POLICY IF EXISTS "github_repos_owner"             ON github_repos;
DROP POLICY IF EXISTS "projects_owner"                 ON projects;
DROP POLICY IF EXISTS "application_projects_owner"     ON application_projects;

CREATE POLICY "github_connections_select_own"
  ON github_connections FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "github_connections_delete_own"
  ON github_connections FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "github_repos_owner"
  ON github_repos FOR ALL TO authenticated
  USING  (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "projects_owner"
  ON projects FOR ALL TO authenticated
  USING  (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "application_projects_owner"
  ON application_projects FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM job_applications ja
      WHERE ja.id = application_id
        AND ja.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM job_applications ja
      WHERE ja.id = application_id
        AND ja.user_id = (select auth.uid())
    )
  );

-- ── user_feedback ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "users can insert own feedback" ON user_feedback;

CREATE POLICY "users can insert own feedback"
  ON user_feedback FOR INSERT
  WITH CHECK (user_id = (select auth.uid()));

-- ── document_purge_queue ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "purge_queue_select" ON document_purge_queue;

CREATE POLICY "purge_queue_select"
    ON document_purge_queue FOR SELECT TO authenticated
    USING ((select auth.uid()) = user_id);
