/**
 * Unit tests — GET /api/nesta-ai/attachment-url
 *
 * Path format (post-migration 29):  {userId}/chat-attachments/{sessionId}/{filename}
 * The first segment is the user ID — matches existing storage RLS policy.
 *
 * Covers:
 *   - Auth check (401)
 *   - Missing path → 400
 *   - Path traversal (..) → 403
 *   - Path belonging to another user → 403
 *   - Path not under {userId}/chat-attachments/ → 403
 *   - User-ID prefix attack (uid "aaa" vs "aaabbb") → 403
 *   - Supabase storage error → 404
 *   - Happy path → 200 with signed URL
 *   - Correct bucket / TTL used
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { GET } from "@/app/api/nesta-ai/attachment-url/route";
import { createClient } from "@/lib/supabase/server";

const mockCreate = vi.mocked(createClient);

const USER_ID    = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const SIGNED_URL = "https://project.supabase.co/storage/v1/object/sign/documents/abc?token=xyz";
// New path format: {userId}/chat-attachments/{sessionId}/{filename}
const VALID_PATH = `${USER_ID}/chat-attachments/session-uuid/1234567890_resume.pdf`;

function makeClient(user: unknown = { id: USER_ID }) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    storage: {
      from: vi.fn().mockReturnValue({
        createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: SIGNED_URL }, error: null }),
      }),
    },
  };
}

function makeStorageErrorClient() {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } }, error: null }) },
    storage: {
      from: vi.fn().mockReturnValue({
        createSignedUrl: vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } }),
      }),
    },
  };
}

function getRequest(path: string | null): Request {
  const url = new URL("http://localhost/api/nesta-ai/attachment-url");
  if (path !== null) url.searchParams.set("path", path);
  return new Request(url.toString(), { method: "GET" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCreate.mockResolvedValue(makeClient() as never);
});

// ── Auth ──────────────────────────────────────────────────────────────────────

describe("GET /api/nesta-ai/attachment-url — auth", () => {
  it("returns 401 when not authenticated", async () => {
    mockCreate.mockResolvedValue(makeClient(null) as never);
    const res = await GET(getRequest(VALID_PATH) as never);
    expect(res.status).toBe(401);
  });
});

// ── Input validation ──────────────────────────────────────────────────────────

describe("GET /api/nesta-ai/attachment-url — input validation", () => {
  it("returns 400 when path query param is missing", async () => {
    const res = await GET(getRequest(null) as never);
    expect(res.status).toBe(400);
  });
});

// ── Path security ─────────────────────────────────────────────────────────────

describe("GET /api/nesta-ai/attachment-url — path security", () => {
  it("returns 403 for path traversal with '..'", async () => {
    const res = await GET(getRequest(`${USER_ID}/chat-attachments/../../../etc/passwd`) as never);
    expect(res.status).toBe(403);
  });

  it("returns 403 for '..' embedded mid-segment", async () => {
    const res = await GET(getRequest(`${USER_ID}/chat-attachments/session/../../other/secret.pdf`) as never);
    expect(res.status).toBe(403);
  });

  it("returns 403 when path belongs to a different user", async () => {
    // Other user's path under new format
    const otherUserPath = "other-user-uuid/chat-attachments/session/file.pdf";
    const res = await GET(getRequest(otherUserPath) as never);
    expect(res.status).toBe(403);
  });

  it("returns 403 when path uses old format (chat-attachments/{userId}/...)", async () => {
    // Old path format should be rejected by the new ownership check
    const oldFormatPath = `chat-attachments/${USER_ID}/session/file.pdf`;
    const res = await GET(getRequest(oldFormatPath) as never);
    expect(res.status).toBe(403);
  });

  it("returns 403 when path does not contain /chat-attachments/ segment", async () => {
    // Trying to access document library path via this endpoint
    const wrongSegment = `${USER_ID}/library/my-resume.pdf`;
    const res = await GET(getRequest(wrongSegment) as never);
    expect(res.status).toBe(403);
  });

  it("returns 403 for user-ID prefix attack (uid is prefix of another uid)", async () => {
    // Attacker ID = USER_ID, victim ID = USER_ID + "extra"
    const prefixAttack = `${USER_ID}extra/chat-attachments/session/file.pdf`;
    const res = await GET(getRequest(prefixAttack) as never);
    expect(res.status).toBe(403);
  });
});

// ── Storage ───────────────────────────────────────────────────────────────────

describe("GET /api/nesta-ai/attachment-url — storage", () => {
  it("returns 404 when Supabase storage cannot find the file", async () => {
    mockCreate.mockResolvedValue(makeStorageErrorClient() as never);
    const res = await GET(getRequest(VALID_PATH) as never);
    expect(res.status).toBe(404);
  });

  it("returns 200 with signed URL for a valid owned path", async () => {
    const res = await GET(getRequest(VALID_PATH) as never);
    expect(res.status).toBe(200);
    expect((await res.json()).signedUrl).toBe(SIGNED_URL);
  });

  it("calls createSignedUrl with correct bucket and 10-minute TTL", async () => {
    const client = makeClient();
    mockCreate.mockResolvedValue(client as never);
    await GET(getRequest(VALID_PATH) as never);
    const storageFrom = (client.storage.from as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const createSignedUrl = (client.storage.from as ReturnType<typeof vi.fn>)
      .mock.results[0].value.createSignedUrl as ReturnType<typeof vi.fn>;
    expect(storageFrom).toBe("documents");
    expect(createSignedUrl).toHaveBeenCalledWith(VALID_PATH, 600); // 60 * 10 seconds
  });
});
