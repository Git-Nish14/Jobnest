-- Fix Supabase performance linter warnings
-- Part A: Add 5 missing indexes on unindexed foreign key columns
-- Part B: Drop 16 indexes confirmed redundant/unused — keeping every FK sole-cover and
--         every index needed by Stripe, fulltext search, or active feature queries

-- ============================================================
-- A. ADD INDEXES FOR UNINDEXED FOREIGN KEYS
-- ============================================================

-- assessments.application_id → job_applications(id) ON DELETE SET NULL
CREATE INDEX IF NOT EXISTS idx_assessments_application_id
    ON assessments (application_id);

-- document_shared_links.document_id → application_documents(id) ON DELETE CASCADE
CREATE INDEX IF NOT EXISTS idx_doc_shared_links_document_id
    ON document_shared_links (document_id);

-- document_shared_links.user_id → auth.users(id) ON DELETE CASCADE
CREATE INDEX IF NOT EXISTS idx_doc_shared_links_user_id
    ON document_shared_links (user_id);

-- projects.github_repo_id → github_repos(id) ON DELETE SET NULL
CREATE INDEX IF NOT EXISTS idx_projects_github_repo_id
    ON projects (github_repo_id);

-- user_feedback.user_id → auth.users(id) ON DELETE CASCADE
CREATE INDEX IF NOT EXISTS idx_user_feedback_user_id
    ON user_feedback (user_id);


-- ============================================================
-- B. DROP REDUNDANT / UNUSED INDEXES
--
-- Decision criteria for each drop:
--   1. The FK it might cover has another index already (shown below)
--   2. OR the column is not a FK at all
--   3. OR the index is superseded by a more useful composite index
--
-- Indexes NOT dropped despite being "unused":
--   idx_application_tags_tag_id       — sole FK cover for application_tags.tag_id
--   idx_reminders_remind_at           — needed for reminder dispatch (future cron)
--   idx_interviews_user_status_scheduled — sole FK cover for interviews.user_id
--   idx_subscriptions_stripe_customer — critical for Stripe webhook row lookups
--   idx_subscriptions_stripe_subscription — same
--   idx_doc_shared_links_expires      — needed for expired-link cleanup queries
--   idx_interview_questions_interview_id — sole FK cover for interview_questions.interview_id
--   job_applications_search_idx       — GIN index backing full-text search feature
--   idx_chat_sessions_pinned          — partial index for pinned-sessions feature path
--   idx_purge_queue_user              — sole FK cover for document_purge_queue.user_id
--   idx_app_projects_proj             — sole FK cover for application_projects.project_id
--   idx_coding_problems_status        — sole remaining FK cover for coding_problems.user_id
-- ============================================================

-- job_applications: user_id still covered by idx_job_applications_user_date(user_id, applied_date)
DROP INDEX IF EXISTS idx_job_applications_user_status;

-- job_applications: user_id covered by many others; company_tier not yet queried in production
DROP INDEX IF EXISTS ix_job_applications_company_tier;

-- pending_deletions: user_id is NOT a FK on this table (intentional per migration comment)
-- Feature is not active — no Edge Function or cron triggers these
DROP INDEX IF EXISTS idx_pending_deletions_user_id;
DROP INDEX IF EXISTS idx_pending_deletions_scheduled_at;
DROP INDEX IF EXISTS idx_pending_deletions_reminder;
DROP INDEX IF EXISTS idx_pending_deletions_final_warning;

-- coding_problems: user_id FK still covered by idx_coding_problems_status(user_id, status)
DROP INDEX IF EXISTS idx_coding_problems_user_id;

-- assessments: user_id FK still covered by idx_assessments_deadline(user_id, deadline)
DROP INDEX IF EXISTS idx_assessments_user_id;

-- reminders: is_completed is a boolean — low cardinality, standalone index is ineffective
DROP INDEX IF EXISTS idx_reminders_is_completed;

-- chat_sessions: updated_at covered by idx_chat_sessions_user_updated(user_id, updated_at DESC)
DROP INDEX IF EXISTS idx_chat_sessions_updated_at;

-- chat_messages: created_at alone is not selective; queries always filter by session_id first
DROP INDEX IF EXISTS idx_chat_messages_created_at;

-- mock_interviews: user_id FK still covered by idx_mock_interviews_scheduled(user_id, scheduled_at)
DROP INDEX IF EXISTS idx_mock_interviews_user_id;

-- github_repos: user_id FK still covered by idx_github_repos_pinned(user_id, is_pinned)
DROP INDEX IF EXISTS idx_github_repos_user;

-- projects: user_id FK still covered by idx_projects_order(user_id, display_order)
DROP INDEX IF EXISTS idx_projects_user;

-- user_feedback: admin-only table; created_at sort not performance-sensitive; user_id now covered by idx_user_feedback_user_id added above
DROP INDEX IF EXISTS ix_user_feedback_created_at;

-- document_purge_queue: purge cron not active yet; purge_at partial index safely dropped
-- (user_id FK still covered by idx_purge_queue_user which we are keeping)
DROP INDEX IF EXISTS idx_purge_queue_pending;
