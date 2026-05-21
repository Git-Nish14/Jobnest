-- Migration: user_feedback table for NPS / in-app feedback

create table user_feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  score       smallint not null check (score between 0 and 10),
  comment     text,
  created_at  timestamptz not null default now()
);

comment on table user_feedback is
  'NPS/CSAT scores collected via in-app feedback modal. One row per submission.';

-- RLS: users can only insert their own feedback; no self-read (analytics is admin-only)
alter table user_feedback enable row level security;

create policy "users can insert own feedback"
  on user_feedback for insert
  with check (user_id = auth.uid());

-- Index for admin analytics queries
create index ix_user_feedback_created_at on user_feedback (created_at desc);
