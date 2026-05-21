-- Migration: company_tier column on job_applications
-- Allows users to tag applications by company prestige tier for filtering and analytics.

create type company_tier as enum ('FAANG', 'Tier 1', 'Tier 2', 'Tier 3', 'Startup');

alter table job_applications
  add column company_tier company_tier null;

comment on column job_applications.company_tier is
  'Optional prestige tier: FAANG, Tier 1 (top-tier), Tier 2 (mid-size), Tier 3 (smaller), Startup';

create index ix_job_applications_company_tier
  on job_applications (user_id, company_tier)
  where company_tier is not null;
