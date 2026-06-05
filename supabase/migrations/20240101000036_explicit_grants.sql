-- Explicit Data API grants required by Supabase from October 30, 2026.
-- Previously all public-schema tables were implicitly granted to anon/authenticated
-- by default; after that date only tables with explicit grants are reachable via
-- PostgREST, GraphQL, and supabase-js.
--
-- RLS policies remain the authoritative enforcement layer — these grants only allow
-- Postgres to attempt the query; RLS still filters which rows each user can touch.
--
-- anon role:         no grants — nothing is publicly accessible without auth.
-- service-role only: otp_codes, pending_deletions, usernames — intentionally excluded.

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.job_applications,
  public.contacts,
  public.interviews,
  public.tags,
  public.application_tags,
  public.activity_logs,
  public.reminders,
  public.email_templates,
  public.salary_details,
  public.chat_sessions,
  public.chat_messages,
  public.subscriptions,
  public.application_documents,
  public.document_shared_links,
  public.notifications,
  public.skills,
  public.certifications,
  public.education,
  public.coding_problems,
  public.assessments,
  public.behavioral_answers,
  public.mock_interviews,
  public.interview_questions,
  public.prep_streaks,
  public.document_annotations,
  public.github_connections,
  public.github_repos,
  public.projects,
  public.application_projects,
  public.user_feedback,
  public.rate_limits
TO authenticated;

-- Users may SELECT their own queued deletions; writes are service-role only.
GRANT SELECT ON TABLE public.document_purge_queue TO authenticated;
