/**
 * Unit tests for web/lib/features/nestai-rag.ts
 *
 * All external I/O (OpenAI API, Supabase) is mocked via vi.mock / vi.fn so
 * no real network calls or DB connections are made.
 *
 * Coverage:
 *  - generateEmbedding: happy path, API error, absent key, oversized input
 *  - buildEmbeddingContent: all four source types, sparse data, empty
 *  - hasRecentEmbeddings: count > 0, count = 0, DB error
 *  - upsertEmbeddings: skips absent key, calls upsert per item, skips empty content
 *  - semanticSearch: RPC success, embedding failure, RPC error
 *  - buildRagContext: full pipeline (index + search), embedding absent, RPC fail → null
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mocks must be hoisted before the module under test is imported ─────────────
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import {
  generateEmbedding,
  buildEmbeddingContent,
  hasRecentEmbeddings,
  upsertEmbeddings,
  semanticSearch,
  buildRagContext,
} from "@/lib/features/nestai-rag";

// ── Helpers ───────────────────────────────────────────────────────────────────

const FAKE_VEC = Array.from({ length: 1536 }, (_, i) => i / 1536);

/** Minimal Supabase client stub for RAG tests */
function makeSupabase(opts: {
  countResult?: { count: number | null; error: unknown };
  upsertResult?: { error: unknown };
  rpcResult?:   { data: unknown; error: unknown };
} = {}) {
  const { countResult, upsertResult, rpcResult } = opts;

  const chain: Record<string, unknown> = {};
  const ret = () => vi.fn().mockReturnValue(chain);

  chain.select  = ret();
  chain.upsert  = vi.fn().mockReturnValue(chain);
  chain.eq      = ret();
  chain.gte     = ret();
  chain.then    = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(upsertResult ?? { error: null }).then(resolve);

  // maybeSingle / single / head-only count
  chain.single      = vi.fn().mockResolvedValue({ data: null, error: null });
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  // When count: "exact" + head: true is used, vitest resolves via the chain's then
  Object.assign(chain, countResult
    ? { then: (res: (v: unknown) => unknown) => Promise.resolve(countResult).then(res) }
    : {});

  return {
    from: vi.fn().mockReturnValue(chain),
    rpc:  vi.fn().mockResolvedValue(rpcResult ?? { data: [], error: null }),
  };
}

// ── generateEmbedding ─────────────────────────────────────────────────────────

describe("generateEmbedding", () => {
  const originalFetch = global.fetch;
  const originalEnv   = process.env.OPENAI_API_KEY;

  beforeEach(() => { process.env.OPENAI_API_KEY = "sk-test-key"; });
  afterEach(() => {
    global.fetch = originalFetch;
    process.env.OPENAI_API_KEY = originalEnv;
  });

  it("returns a 1536-length number array on success", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: [{ embedding: FAKE_VEC }] }),
    } as unknown as Response);

    const result = await generateEmbedding("hello world");
    expect(result).toHaveLength(1536);
    expect(result![0]).toBeCloseTo(0);
  });

  it("returns null when OPENAI_API_KEY is absent", async () => {
    delete process.env.OPENAI_API_KEY;
    global.fetch = vi.fn();

    const result = await generateEmbedding("hello");
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns null when the OpenAI API returns a non-OK response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: vi.fn().mockResolvedValue("rate limited"),
    } as unknown as Response);

    const result = await generateEmbedding("hello");
    expect(result).toBeNull();
  });

  it("returns null when fetch throws (network error)", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network failure"));
    const result = await generateEmbedding("hello");
    expect(result).toBeNull();
  });

  it("slices input to MAX_TEXT_CHARS (8000) before sending", async () => {
    let captured = "";
    global.fetch = vi.fn().mockImplementation(async (_url: unknown, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      captured = body.input;
      return { ok: true, json: async () => ({ data: [{ embedding: FAKE_VEC }] }) };
    });

    const longText = "x".repeat(12_000);
    await generateEmbedding(longText);
    expect(captured.length).toBe(8_000);
  });
});

// ── buildEmbeddingContent ─────────────────────────────────────────────────────

describe("buildEmbeddingContent", () => {
  it("application: includes company, position, status, notes", () => {
    const content = buildEmbeddingContent("application", {
      company: "Acme Corp", position: "Engineer", status: "Applied", notes: "Great fit",
    });
    expect(content).toContain("Company: Acme Corp");
    expect(content).toContain("Position: Engineer");
    expect(content).toContain("Status: Applied");
    expect(content).toContain("Notes: Great fit");
  });

  it("application: omits undefined fields", () => {
    const content = buildEmbeddingContent("application", { company: "Acme" });
    expect(content).toContain("Company: Acme");
    expect(content).not.toContain("Position:");
    expect(content).not.toContain("Notes:");
  });

  it("application: truncates job_description to 2000 chars", () => {
    const content = buildEmbeddingContent("application", {
      company: "X", job_description: "y".repeat(5_000),
    });
    expect(content.length).toBeLessThan(5_000);
  });

  it("contact: includes name, company, role, email, notes", () => {
    const content = buildEmbeddingContent("contact", {
      name: "Alice", company: "Acme", role: "Recruiter", email: "a@b.com", notes: "Met at career fair",
    });
    expect(content).toContain("Name: Alice");
    expect(content).toContain("Role: Recruiter");
    expect(content).toContain("Email: a@b.com");
  });

  it("reminder: includes title, type, description", () => {
    const content = buildEmbeddingContent("reminder", {
      title: "Follow up with Google", type: "Follow Up", description: "Send thank you email",
    });
    expect(content).toContain("Reminder: Follow up with Google");
    expect(content).toContain("Type: Follow Up");
    expect(content).toContain("Description: Send thank you email");
  });

  it("email_template: includes name, category, subject, body (truncated)", () => {
    const content = buildEmbeddingContent("email_template", {
      name: "Thank You", category: "Thank You", subject: "Re: Interview", body: "b".repeat(2_000),
    });
    expect(content).toContain("Template: Thank You");
    expect(content).toContain("Subject: Re: Interview");
    expect(content.length).toBeLessThan(2_500); // body truncated to 1000
  });

  it("returns empty string for an empty object", () => {
    expect(buildEmbeddingContent("application", {})).toBe("");
    expect(buildEmbeddingContent("contact", {})).toBe("");
  });
});

// ── hasRecentEmbeddings ───────────────────────────────────────────────────────

describe("hasRecentEmbeddings", () => {
  it("returns true when count > 0", async () => {
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockResolvedValue({ count: 5, error: null }),
          }),
        }),
      }),
    };
    const result = await hasRecentEmbeddings(supabase as any, "user-1");
    expect(result).toBe(true);
  });

  it("returns false when count = 0", async () => {
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockResolvedValue({ count: 0, error: null }),
          }),
        }),
      }),
    };
    const result = await hasRecentEmbeddings(supabase as any, "user-1");
    expect(result).toBe(false);
  });

  it("returns false when count is null (DB error)", async () => {
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockResolvedValue({ count: null, error: { message: "error" } }),
          }),
        }),
      }),
    };
    const result = await hasRecentEmbeddings(supabase as any, "user-1");
    expect(result).toBe(false);
  });
});

// ── upsertEmbeddings ──────────────────────────────────────────────────────────

describe("upsertEmbeddings", () => {
  const originalFetch = global.fetch;
  const originalKey   = process.env.OPENAI_API_KEY;

  beforeEach(() => { process.env.OPENAI_API_KEY = "sk-test"; });
  afterEach(() => {
    global.fetch = originalFetch;
    process.env.OPENAI_API_KEY = originalKey;
  });

  it("does nothing when OPENAI_API_KEY is absent", async () => {
    delete process.env.OPENAI_API_KEY;
    global.fetch = vi.fn();
    const supabase = makeSupabase();

    await upsertEmbeddings(supabase as any, "user-1", [
      { sourceType: "application", sourceId: "app-1", data: { company: "Acme" } },
    ]);

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("does nothing when items array is empty", async () => {
    global.fetch = vi.fn();
    const supabase = makeSupabase();

    await upsertEmbeddings(supabase as any, "user-1", []);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("skips items whose buildEmbeddingContent returns empty string", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: [{ embedding: FAKE_VEC }] }),
    } as unknown as Response);
    const supabase = makeSupabase();

    await upsertEmbeddings(supabase as any, "user-1", [
      { sourceType: "application", sourceId: "app-1", data: {} }, // empty → skipped
    ]);

    // fetch is called by generateEmbedding — but for empty content we never reach it
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("calls upsert once per item that has content and gets an embedding", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: [{ embedding: FAKE_VEC }] }),
    } as unknown as Response);

    const upsertSpy = vi.fn().mockReturnValue({
      then: (res: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(res),
    });
    const supabase = { from: vi.fn().mockReturnValue({ upsert: upsertSpy }) };

    await upsertEmbeddings(supabase as any, "user-1", [
      { sourceType: "application", sourceId: "app-1", data: { company: "Acme" } },
      { sourceType: "contact",     sourceId: "con-1", data: { name: "Alice" } },
    ]);

    expect(upsertSpy).toHaveBeenCalledTimes(2);
  });
});

// ── semanticSearch ────────────────────────────────────────────────────────────

describe("semanticSearch", () => {
  const originalFetch = global.fetch;
  const originalKey   = process.env.OPENAI_API_KEY;

  beforeEach(() => { process.env.OPENAI_API_KEY = "sk-test"; });
  afterEach(() => {
    global.fetch = originalFetch;
    process.env.OPENAI_API_KEY = originalKey;
  });

  it("returns empty array when generateEmbedding returns null (no key)", async () => {
    delete process.env.OPENAI_API_KEY;
    const supabase = makeSupabase();
     
    const result = await semanticSearch(supabase as any, "user-1", "find Google apps");
    expect(result).toEqual([]);
  });

  it("returns search results from the RPC on success", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: [{ embedding: FAKE_VEC }] }),
    } as unknown as Response);

    const mockRows = [
      { source_type: "application", source_id: "app-1", content: "Company: Google", similarity: 0.93 },
    ];
    const supabase = { rpc: vi.fn().mockResolvedValue({ data: mockRows, error: null }) };

     
    const result = await semanticSearch(supabase as any, "user-1", "Google applications", 10);
    expect(result).toHaveLength(1);
    expect(result[0].source_type).toBe("application");
    expect(result[0].similarity).toBeCloseTo(0.93);
  });

  it("returns empty array when RPC returns an error", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: [{ embedding: FAKE_VEC }] }),
    } as unknown as Response);

    const supabase = { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "rpc failed" } }) };

     
    const result = await semanticSearch(supabase as any, "user-1", "anything");
    expect(result).toEqual([]);
  });

  it("passes sourceTypes filter to the RPC when provided", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: [{ embedding: FAKE_VEC }] }),
    } as unknown as Response);

    const rpcSpy = vi.fn().mockResolvedValue({ data: [], error: null });
    const supabase = { rpc: rpcSpy };

     
    await semanticSearch(supabase as any, "user-1", "query", 5, ["application", "contact"]);

    expect(rpcSpy).toHaveBeenCalledWith(
      "nestai_semantic_search",
      expect.objectContaining({ p_source_types: ["application", "contact"], p_limit: 5 }),
    );
  });
});

// ── buildRagContext ───────────────────────────────────────────────────────────

describe("buildRagContext", () => {
  const originalFetch = global.fetch;
  const originalKey   = process.env.OPENAI_API_KEY;

  beforeEach(() => { process.env.OPENAI_API_KEY = "sk-test"; });
  afterEach(() => {
    global.fetch = originalFetch;
    process.env.OPENAI_API_KEY = originalKey;
  });

  it("returns null when OPENAI_API_KEY is absent", async () => {
    delete process.env.OPENAI_API_KEY;
    const supabase = makeSupabase();

     
    const result = await buildRagContext({
      supabase: supabase as any,
      userId: "user-1", query: "find jobs",
      applications: [], contacts: [], reminders: [], emailTemplates: [],
    });

    expect(result).toBeNull();
  });

  it("returns a non-null context string when search succeeds", async () => {
    // Mock embedding + has-recent-embeddings (returns true — skips re-index)
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: [{ embedding: FAKE_VEC }] }),
    } as unknown as Response);

    const mockRows = [
      { source_type: "application", source_id: "app-1", content: "Company: Google\nPosition: SWE", similarity: 0.95 },
      { source_type: "contact",     source_id: "con-1", content: "Name: Alice\nCompany: Google",   similarity: 0.87 },
    ];

    // Supabase: count=5 (has recent embeddings → skip re-index), rpc returns rows
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockResolvedValue({ count: 5, error: null }),
          }),
        }),
        upsert: vi.fn().mockReturnValue({ then: (r: (v:unknown)=>unknown) => Promise.resolve({ error: null }).then(r) }),
      }),
      rpc: vi.fn().mockResolvedValue({ data: mockRows, error: null }),
    };

     
    const result = await buildRagContext({
      supabase: supabase as any,
      userId: "user-1", query: "Google applications",
      applications: [{ id: "app-1", company: "Google", position: "SWE" }],
      contacts: [{ id: "con-1", name: "Alice" }],
      reminders: [], emailTemplates: [],
    });

    expect(result).not.toBeNull();
    expect(result).toContain("semantic similarity");
    expect(result).toContain("Company: Google");
  });

  it("returns null when semanticSearch returns no results", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: [{ embedding: FAKE_VEC }] }),
    } as unknown as Response);

    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockResolvedValue({ count: 3, error: null }),
          }),
        }),
      }),
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    };

     
    const result = await buildRagContext({
      supabase: supabase as any,
      userId: "user-1", query: "unrelated query",
      applications: [], contacts: [], reminders: [], emailTemplates: [],
    });

    expect(result).toBeNull();
  });

  it("filters out completed reminders before indexing", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: [{ embedding: FAKE_VEC }] }),
    } as unknown as Response);

    const upsertSpy = vi.fn().mockReturnValue({
      then: (r: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(r),
    });

    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockResolvedValue({ count: 0, error: null }),  // force re-index
          }),
        }),
        upsert: upsertSpy,
      }),
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    };

    const reminders = [
      { id: "rem-1", title: "Follow up", is_completed: false },
      { id: "rem-2", title: "Done task",  is_completed: true  },
    ];

     
    await buildRagContext({
      supabase: supabase as any,
      userId: "user-1", query: "reminders",
      applications: [], contacts: [], reminders, emailTemplates: [],
    });

    // Only 1 reminder should have been attempted (the non-completed one)
    const upsertCalls = upsertSpy.mock.calls;
    const reminderUpserts = upsertCalls.filter(
      (call: unknown[]) => (call[0] as { source_type?: string })?.source_type === "reminder",
    );
    expect(reminderUpserts).toHaveLength(1);
  });
});
