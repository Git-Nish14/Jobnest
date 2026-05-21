/**
 * Unit tests — GET /api/nesta-ai/sessions/[id]/export-pdf
 *
 * Covers:
 *  - Auth check              → 401
 *  - Session not found       → 404
 *  - Session belongs to a different user → 404 (IDOR guard)
 *  - Message fetch error     → 500
 *  - Happy path              → 200 PDF response with correct headers
 *
 * renderToBuffer is mocked — PDF generation is an integration concern.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeChain } from "@/tests/helpers/supabase-mock";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@react-pdf/renderer", () => ({
  renderToBuffer: vi.fn().mockResolvedValue(Buffer.from("%PDF-1.4 fake")),
  Document: vi.fn(),
  Page:     vi.fn(),
  Text:     vi.fn(),
  View:     vi.fn(),
  StyleSheet: { create: vi.fn().mockReturnValue({}) },
}));
// ChatPDFDocument uses @react-pdf/renderer — mock the component itself too
vi.mock("@/components/nestai/ChatPDFDocument", () => ({
  ChatPDFDocument: vi.fn().mockReturnValue(null),
}));

import { GET } from "@/app/api/nesta-ai/sessions/[id]/export-pdf/route";
import { createClient } from "@/lib/supabase/server";

const mockCreate = vi.mocked(createClient);

const USER_ID    = "user-uuid-export";
const SESSION_ID = "session-uuid-export";

const FAKE_SESSION = { id: SESSION_ID, title: "My Chat Session", created_at: "2026-05-01T10:00:00Z" };
const FAKE_MSGS    = [{ role: "user", content: "Hello", created_at: "2026-05-01T10:01:00Z" }];

function makeClient(opts: {
  user?: unknown;
  session?: unknown;
  sessionError?: unknown;
  messages?: unknown[];
  messagesError?: unknown;
} = {}) {
  const {
    user          = { id: USER_ID },
    session       = FAKE_SESSION,
    sessionError  = null,
    messages      = FAKE_MSGS,
    messagesError = null,
  } = opts;

  const sessionChain  = makeChain({ data: session, error: sessionError });
  const messagesChain = makeChain({ data: messages, error: messagesError });

  const fromFn = vi.fn()
    .mockReturnValueOnce(sessionChain)   // first call: fetch session
    .mockReturnValueOnce(messagesChain); // second call: fetch messages

  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    from: fromFn,
  };
}

function makeRequest(sessionId = SESSION_ID): NextRequest {
  return new NextRequest(`http://localhost/api/nesta-ai/sessions/${sessionId}/export-pdf`);
}

const paramsFor = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  mockCreate.mockResolvedValue(makeClient() as never);
});

// ── Auth ──────────────────────────────────────────────────────────────────────

describe("GET /api/nesta-ai/sessions/[id]/export-pdf — auth", () => {
  it("returns 401 when user is not authenticated", async () => {
    mockCreate.mockResolvedValue(makeClient({ user: null }) as never);
    const res = await GET(makeRequest(), paramsFor(SESSION_ID));
    expect(res.status).toBe(401);
  });
});

// ── Session guard ─────────────────────────────────────────────────────────────

describe("GET /api/nesta-ai/sessions/[id]/export-pdf — session guard", () => {
  it("returns 404 when session is not found", async () => {
    mockCreate.mockResolvedValue(
      makeClient({ session: null, sessionError: { message: "not found" } }) as never
    );
    const res = await GET(makeRequest(), paramsFor(SESSION_ID));
    expect(res.status).toBe(404);
  });

  it("returns 404 when session belongs to a different user (IDOR guard)", async () => {
    // Supabase RLS + .eq("user_id") means a mis-owned session returns no data
    mockCreate.mockResolvedValue(
      makeClient({ session: null, sessionError: null }) as never
    );
    const res = await GET(makeRequest(), paramsFor(SESSION_ID));
    expect(res.status).toBe(404);
  });
});

// ── Message error ─────────────────────────────────────────────────────────────

describe("GET /api/nesta-ai/sessions/[id]/export-pdf — message fetch error", () => {
  it("returns 500 when message query fails", async () => {
    mockCreate.mockResolvedValue(
      makeClient({ messagesError: { message: "db error" } }) as never
    );
    const res = await GET(makeRequest(), paramsFor(SESSION_ID));
    expect(res.status).toBe(500);
  });
});

// ── Happy path ────────────────────────────────────────────────────────────────

describe("GET /api/nesta-ai/sessions/[id]/export-pdf — success", () => {
  it("returns 200 with application/pdf content-type", async () => {
    const res = await GET(makeRequest(), paramsFor(SESSION_ID));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
  });

  it("sets Content-Disposition with attachment and sanitized session title", async () => {
    const res = await GET(makeRequest(), paramsFor(SESSION_ID));
    const cd  = res.headers.get("Content-Disposition") ?? "";
    expect(cd).toContain("attachment");
    expect(cd).toContain("nestai-");
    // The filename segment (after filename=") must not contain spaces —
    // the safeTitle regex strips non-alphanumeric chars including spaces
    const filenameMatch = cd.match(/filename="([^"]+)"/);
    expect(filenameMatch).not.toBeNull();
    expect(filenameMatch![1]).not.toContain(" ");
  });

  it("queries session with both id and user_id (prevents IDOR)", async () => {
    const client = makeClient() as ReturnType<typeof makeClient>;
    mockCreate.mockResolvedValue(client as never);

    await GET(makeRequest(), paramsFor(SESSION_ID));

    const sessionChain = client.from.mock.results[0].value;
    const eqFn = (sessionChain as { eq: ReturnType<typeof vi.fn> }).eq;
    const calls = eqFn.mock.calls as [string, string][];

    expect(calls.some(([k, v]) => k === "id"      && v === SESSION_ID)).toBe(true);
    expect(calls.some(([k, v]) => k === "user_id" && v === USER_ID)).toBe(true);
  });
});
