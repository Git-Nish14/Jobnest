-- Migration 048: pgvector hybrid search (BM25 + cosine + RRF) and NESTAi conversation memory
-- ─────────────────────────────────────────────────────────────────────────────────────────────

-- ── 1. GIN index on nestai_embeddings.content for full-text BM25 search ──────────────────────
-- Enables fast to_tsvector / @@ queries used in the hybrid search below.
create index if not exists nestai_embeddings_fts_idx
  on public.nestai_embeddings
  using gin (to_tsvector('english', content));

-- ── 2. Hybrid search RPC: BM25 + cosine similarity with Reciprocal Rank Fusion ──────────────
-- Returns top-K results ranked by fused score (vector + full-text).
-- Falls back gracefully if p_query yields no full-text matches (pure vector path).
create or replace function public.nestai_hybrid_search(
  p_user_id      uuid,
  p_embedding    vector(1536),
  p_query        text,
  p_source_types text[]  default null,
  p_limit        int     default 20,
  p_rrf_k        int     default 60
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
declare
  v_tsquery tsquery;
begin
  -- Ownership check: SECURITY DEFINER runs as the function owner, so we MUST
  -- explicitly verify the caller owns the requested user_id. Without this, any
  -- authenticated user could read any other user's embeddings.
  if auth.uid() is distinct from p_user_id then
    raise exception 'unauthorized';
  end if;

  -- Safe query parse — returns null for blank/invalid input
  begin
    v_tsquery := plainto_tsquery('english', p_query);
  exception when others then
    v_tsquery := null;
  end;

  return query
  with
  -- Vector-ranked candidates (cosine similarity)
  vector_ranked as (
    select
      e.source_type,
      e.source_id,
      e.content,
      row_number() over (order by e.embedding <=> p_embedding) as rank
    from public.nestai_embeddings e
    where
      e.user_id = p_user_id
      and (p_source_types is null or e.source_type = any(p_source_types))
    order by e.embedding <=> p_embedding
    limit p_limit * 4
  ),
  -- BM25 full-text ranked candidates (only when tsquery is non-null)
  text_ranked as (
    select
      e.source_type,
      e.source_id,
      e.content,
      row_number() over (
        order by ts_rank_cd(to_tsvector('english', e.content), v_tsquery) desc
      ) as rank
    from public.nestai_embeddings e
    where
      e.user_id = p_user_id
      and (p_source_types is null or e.source_type = any(p_source_types))
      and v_tsquery is not null
      and to_tsvector('english', e.content) @@ v_tsquery
    order by ts_rank_cd(to_tsvector('english', e.content), v_tsquery) desc
    limit p_limit * 4
  ),
  -- Reciprocal Rank Fusion: 1/(k+rank) from each signal, summed
  fused as (
    select
      coalesce(v.source_type, t.source_type) as source_type,
      coalesce(v.source_id,   t.source_id)   as source_id,
      coalesce(v.content,     t.content)     as content,
      coalesce(1.0 / (p_rrf_k + v.rank), 0.0)
        + coalesce(1.0 / (p_rrf_k + t.rank), 0.0) as rrf_score
    from vector_ranked v
    full outer join text_ranked t
      on  v.source_type = t.source_type
      and v.source_id   = t.source_id
  )
  select
    f.source_type,
    f.source_id,
    f.content,
    f.rrf_score::double precision as similarity
  from fused f
  order by f.rrf_score desc
  limit p_limit;
end;
$$;

-- Grant only to authenticated users — service_role is not needed here.
-- The ownership check (auth.uid() IS DISTINCT FROM p_user_id) means service_role
-- calls (where auth.uid() = null) would always fail, so granting it would be
-- dead surface area.
grant execute on function public.nestai_hybrid_search(uuid, vector(1536), text, text[], int, int)
  to authenticated;


-- ── 3. NESTAi user memory table ───────────────────────────────────────────────────────────────
-- Stores extracted per-user preferences that persist across NESTAi sessions.
-- Populated by /api/nesta-ai/memory after sufficient conversation history.
create table if not exists public.nestai_memory (
  user_id     uuid        primary key references auth.users(id) on delete cascade,
  -- 2 000 char hard cap: ~500 tokens, well within system-prompt budget.
  -- The API layer also enforces an 800-char injection cap as defence-in-depth.
  preferences text        not null default '' check (char_length(preferences) <= 2000),
  updated_at  timestamptz not null default now()
);

alter table public.nestai_memory enable row level security;

create policy "nestai_memory_owner"
  on public.nestai_memory
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
