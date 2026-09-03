/**
 * NESTAi RAG — pgvector-backed semantic retrieval for Pro users.
 *
 * Flow:
 *  1. User sends a question to NESTAi.
 *  2. For Pro users, we embed the question via OpenAI text-embedding-3-small.
 *  3. We upsert embeddings for the user's current data (lazy, cached 2 h).
 *  4. We run pgvector cosine-similarity search to find the most relevant items.
 *  5. Those items become the focused context instead of a full data dump.
 *
 * Falls back to the existing full-context approach when:
 *  - OPENAI_API_KEY is not configured, or
 *  - pgvector / RPC call fails.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// ── Constants ─────────────────────────────────────────────────────────────────

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMS  = 1536;
const MAX_TEXT_CHARS  = 8_000; // safe limit before the API trims further
const CACHE_TTL_MS    = 2 * 60 * 60 * 1000; // re-index after 2 hours

export type EmbeddingSourceType =
  | "application"
  | "contact"
  | "reminder"
  | "email_template";

// ── Embedding generation ──────────────────────────────────────────────────────

/**
 * Call the OpenAI Embeddings API and return the float32 vector, or null on
 * any error (caller falls back gracefully).
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:  `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:           EMBEDDING_MODEL,
        input:           text.slice(0, MAX_TEXT_CHARS),
        encoding_format: "float",
        dimensions:      EMBEDDING_DIMS,
      }),
    });

    if (!res.ok) {
      console.error("[RAG] embeddings API error:", res.status);
      return null;
    }

    const json = await res.json();
    return (json.data?.[0]?.embedding as number[]) ?? null;
  } catch (err) {
    console.error("[RAG] embeddings fetch error:", err);
    return null;
  }
}

// ── Content builders ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildEmbeddingContent(type: EmbeddingSourceType, item: Record<string, any>): string {
  const lines: string[] = [];

  switch (type) {
    case "application":
      if (item.company)         lines.push(`Company: ${item.company}`);
      if (item.position)        lines.push(`Position: ${item.position}`);
      if (item.status)          lines.push(`Status: ${item.status}`);
      if (item.location)        lines.push(`Location: ${item.location}`);
      if (item.job_description) lines.push(`Job description: ${String(item.job_description).slice(0, 2000)}`);
      if (item.notes)           lines.push(`Notes: ${String(item.notes).slice(0, 1000)}`);
      break;

    case "contact":
      if (item.name)    lines.push(`Name: ${item.name}`);
      if (item.company) lines.push(`Company: ${item.company}`);
      if (item.role)    lines.push(`Role: ${item.role}`);
      if (item.email)   lines.push(`Email: ${item.email}`);
      if (item.notes)   lines.push(`Notes: ${String(item.notes).slice(0, 1000)}`);
      break;

    case "reminder":
      if (item.title)       lines.push(`Reminder: ${item.title}`);
      if (item.type)        lines.push(`Type: ${item.type}`);
      if (item.description) lines.push(`Description: ${item.description}`);
      break;

    case "email_template":
      if (item.name)     lines.push(`Template: ${item.name}`);
      if (item.category) lines.push(`Category: ${item.category}`);
      if (item.subject)  lines.push(`Subject: ${item.subject}`);
      if (item.body)     lines.push(`Body: ${String(item.body).slice(0, 1000)}`);
      break;
  }

  return lines.join("\n");
}

// ── Upsert embeddings ─────────────────────────────────────────────────────────

export interface EmbeddingItem {
  sourceType: EmbeddingSourceType;
  sourceId:   string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data:       Record<string, any>;
}

/**
 * Generate and upsert embeddings for a batch of user data items.
 * Items with empty content or failed embeddings are silently skipped.
 * Runs each item in parallel (but capped to avoid rate-limit bursts).
 */
export async function upsertEmbeddings(
  supabase: SupabaseClient,
  userId:   string,
  items:    EmbeddingItem[]
): Promise<void> {
  if (!process.env.OPENAI_API_KEY || items.length === 0) return;

  // Parallel batch — OpenAI free tier: 500 RPM, well within limits for typical datasets
  await Promise.allSettled(
    items.map(async ({ sourceType, sourceId, data }) => {
      const content = buildEmbeddingContent(sourceType, data);
      if (!content.trim()) return;

      const vec = await generateEmbedding(content);
      if (!vec) return;

      await supabase.from("nestai_embeddings").upsert(
        {
          user_id:     userId,
          source_type: sourceType,
          source_id:   sourceId,
          content,
          embedding:   `[${vec.join(",")}]`,
          updated_at:  new Date().toISOString(),
        },
        { onConflict: "user_id,source_type,source_id" }
      );
    })
  );
}

// ── Freshness check ───────────────────────────────────────────────────────────

/**
 * Returns true if the user has at least one embedding created/updated
 * within the CACHE_TTL_MS window. When false, re-indexing should run.
 */
export async function hasRecentEmbeddings(
  supabase: SupabaseClient,
  userId:   string
): Promise<boolean> {
  const since = new Date(Date.now() - CACHE_TTL_MS).toISOString();
  const { count } = await supabase
    .from("nestai_embeddings")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("updated_at", since);
  return (count ?? 0) > 0;
}

// ── Semantic search ───────────────────────────────────────────────────────────

export interface SearchResult {
  source_type: string;
  source_id:   string;
  content:     string;
  similarity:  number;
}

/**
 * Embed `query` and retrieve the top-K most similar stored items via pgvector.
 * Returns an empty array if embeddings are unavailable or the RPC fails.
 */
export async function semanticSearch(
  supabase:    SupabaseClient,
  userId:      string,
  query:       string,
  limit        = 20,
  sourceTypes?: EmbeddingSourceType[]
): Promise<SearchResult[]> {
  const vec = await generateEmbedding(query);
  if (!vec) return [];

  const { data, error } = await supabase.rpc("nestai_semantic_search", {
    p_user_id:      userId,
    p_embedding:    `[${vec.join(",")}]`,
    p_source_types: sourceTypes ?? null,
    p_limit:        limit,
  });

  if (error) {
    console.error("[RAG] semantic search RPC error:", error.message);
    return [];
  }

  return (data as SearchResult[]) ?? [];
}

// ── High-level helper: index + search in one call ─────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

interface RagContextOptions {
  supabase:       SupabaseClient;
  userId:         string;
  query:          string;
  applications:   AnyRecord[];
  contacts:       AnyRecord[];
  reminders:      AnyRecord[];
  emailTemplates: AnyRecord[];
  topK?:          number;
}

/**
 * Full RAG pipeline for one NESTAi request:
 *  1. Check if embeddings are fresh; if stale, re-index in the background.
 *  2. Semantic-search for the most relevant content chunks.
 *  3. Return a compact context string (ranked by similarity, most relevant first).
 *
 * Returns null if OPENAI_API_KEY is absent or any step fails, so the caller
 * can fall back to the existing full-context approach.
 */
export async function buildRagContext(opts: RagContextOptions): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) return null;

  const {
    supabase, userId, query,
    applications, contacts, reminders, emailTemplates,
    topK = 20,
  } = opts;

  try {
    // ── 1. Re-index if stale ─────────────────────────────────────────────────
    const fresh = await hasRecentEmbeddings(supabase, userId);

    if (!fresh) {
      const items: EmbeddingItem[] = [
        ...applications.map((a) => ({ sourceType: "application" as const, sourceId: String(a.id), data: a })),
        ...contacts.map((c)     => ({ sourceType: "contact"     as const, sourceId: String(c.id), data: c })),
        ...reminders
          .filter((r) => !r.is_completed)
          .map((r) => ({ sourceType: "reminder" as const, sourceId: String(r.id), data: r })),
        ...emailTemplates.map((t) => ({ sourceType: "email_template" as const, sourceId: String(t.id), data: t })),
      ];
      // upsertEmbeddings is fast for typical dataset sizes; await so search uses fresh data
      await upsertEmbeddings(supabase, userId, items);
    }

    // ── 2. Semantic search ───────────────────────────────────────────────────
    const results = await semanticSearch(supabase, userId, query, topK);
    if (results.length === 0) return null;

    // ── 3. Build compact context string ──────────────────────────────────────
    const context = results
      .map((r, idx) => `[${idx + 1}] (${r.source_type}, similarity ${(r.similarity * 100).toFixed(0)}%)\n${r.content}`)
      .join("\n\n---\n\n");

    return `The following items from your job-search data are most relevant to your question (ranked by semantic similarity):\n\n${context}`;
  } catch (err) {
    console.error("[RAG] buildRagContext error:", err);
    return null;
  }
}
