-- Separate migration: PostgreSQL enum values must commit before being used.
ALTER TYPE public.application_status ADD VALUE IF NOT EXISTS 'Saved';
ALTER TYPE public.application_status ADD VALUE IF NOT EXISTS 'Preparing';
ALTER TYPE public.application_status ADD VALUE IF NOT EXISTS 'Accepted';
