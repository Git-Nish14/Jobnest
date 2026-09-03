-- Migration 047: NESTAi RAG — pgvector embeddings for semantic context retrieval
-- ============================================================================
-- PREREQUISITE: Enable the pgvector extension in Supabase dashboard before
-- running this migration:
--   Database > Extensions > search "vector" > Enable
-- ============================================================================

-- Enable pgvector (no-op if already enabled; safe to run multiple times)
create extension if not exists vector;

-- ── Table: nestai_embeddings ─────────────────────────────────────────────────
-- Each row stores the vector embedding for one user data item (application,
-- contact, reminder, or email template). Used by NESTAi (Pro) to retrieve
-- the most semantically relevant context for a given question.
create table if not exists public.nestai_embeddings (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  source_type  text        not null,   -- 'application' | 'contact' | 'reminder' | 'email_template'
  source_id    text        not null,   -- UUID of the source row (as text for generality)
  content      text        not null,   -- plain-text chunk that was embedded
  embedding    vector(1536),           -- OpenAI text-embedding-3-small (1 536 dims)
  updated_at   timestamptz not null default now(),

  unique (user_id, source_type, source_id)
);

-- Index for per-user lookups
create index if not exists nestai_embeddings_user_idx
  on public.nestai_embeddings (user_id);

-- IVFFlat approximate nearest-neighbour index for cosine distance.
-- lists = 100 works well up to ~1 M rows; re-index if dataset grows beyond that.
create index if not exists nestai_embeddings_vector_idx
  on public.nestai_embeddings
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.nestai_embeddings enable row level security;

create policy "nestai_embeddings_owner"
  on public.nestai_embeddings
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── RPC: nestai_semantic_search ──────────────────────────────────────────────
-- Called by the NESTAi API to retrieve the top-K most relevant embeddings
-- for a given query vector. Returns rows ordered by cosine similarity desc.
create or replace function public.nestai_semantic_search(
  p_user_id      uuid,
  p_embedding    vector(1536),
  p_source_types text[],
  p_limit        int default 20
)
returns table (
  source_type text,
  source_id   text,
  content     text,
  similarity  double precision
)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Enforce ownership — prevents one user querying another's embeddings
  if auth.uid() is distinct from p_user_id then
    raise exception 'unauthorized';
  end if;

  return query
  select
    e.source_type,
    e.source_id,
    e.content,
    (1.0 - (e.embedding <=> p_embedding))::double precision as similarity
  from public.nestai_embeddings e
  where
    e.user_id = p_user_id
    and (p_source_types is null or e.source_type = any(p_source_types))
  order by e.embedding <=> p_embedding
  limit p_limit;
end;
$$;

grant execute on function public.nestai_semantic_search(uuid, vector(1536), text[], int)
  to authenticated;
