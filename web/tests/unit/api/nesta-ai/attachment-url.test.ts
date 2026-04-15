/**
 * Unit tests — GET /api/nesta-ai/attachment-url
 *
 * Covers:
 *   - Auth check
 *   - Missing path → 400
 *   - Path traversal (..) → 403
 *   - Path belonging to another user → 403
 *   - Path not under chat-attachments prefix → 403
 *   - Supabase storage error → 404
 *   - Happy path → 200 with signed URL
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { GET } from "@/app/api/nesta-ai/attachment-url/route";
import { createClient } from "@/lib/supabase/server";

const mockCreate = vi.mocked(createClient);

const USER_ID    = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const SIGNED_URL = "https://project.supabase.co/storage/v1/object/sign/documents/abc?token=xyz";

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

const VALID_PATH = `chat-attachments/${USER_ID}/session-uuid/1234567890_resume.pdf`;

beforeEach(() => {
  vi.clearAllMocks();
  mockCreate.mockResolvedValue(makeClient() as never);
});

describe("GET /api/nesta-ai/attachment-url — auth", () => {
  it("returns 401 when not authenticated", async () => {
    mockCreate.mockResolvedValue(makeClient(null) as never);
    const res = await GET(getRequest(VALID_PATH) as never);
    expect(res.status).toBe(401);
  });
});

describe("GET /api/nesta-ai/attachment-url — input validation", () => {
  it("returns 400 when path query param is missing", async () => {
    const res = await GET(getRequest(null) as never);
    expect(res.status).toBe(400);
  });
});

describe("GET /api/nesta-ai/attachment-url — path security", () => {
  it("returns 403 when path contains '..' (path traversal attempt)", async () => {
    const traversalPath = `chat-attachments/${USER_ID}/../other-user/secret.pdf`;
    const res = await GET(getRequest(traversalPath) as never);
    expect(res.status).toBe(403);
  });

  it("returns 403 when path contains '..' mid-segment", async () => {
    const traversalPath = `chat-attachments/${USER_ID}/session/../../etc/passwd`;
    const res = await GET(getRequest(traversalPath) as never);
    expect(res.status).toBe(403);
  });

  it("returns 403 when path belongs to a different user", async () => {
    const otherUserPath = "chat-attachments/other-user-uuid/session/file.pdf";
    const res = await GET(getRequest(otherUserPath) as never);
    expect(res.status).toBe(403);
  });

  it("returns 403 when path does not start with chat-attachments prefix", async () => {
    const wrongPrefix = `documents/${USER_ID}/file.pdf`;
    const res = await GET(getRequest(wrongPrefix) as never);
    expect(res.status).toBe(403);
  });

  it("returns 403 when path uses the user id as a prefix of another user id", async () => {
    // e.g. attacker id = "aaa", victim id = "aaabbb" — startsWith would match without trailing slash check
    const prefixAttack = `chat-attachments/${USER_ID}extra/session/file.pdf`;
    const res = await GET(getRequest(prefixAttack) as never);
    expect(res.status).toBe(403);
  });
});

describe("GET /api/nesta-ai/attachment-url — storage", () => {
  it("returns 404 when Supabase storage cannot find the file", async () => {
    mockCreate.mockResolvedValue(makeStorageErrorClient() as never);
    const res = await GET(getRequest(VALID_PATH) as never);
    expect(res.status).toBe(404);
  });

  it("returns 200 with signed URL for a valid owned path", async () => {
    const res = await GET(getRequest(VALID_PATH) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.signedUrl).toBe(SIGNED_URL);
  });

  it("calls createSignedUrl with the exact path and 10-minute TTL", async () => {
    const client = makeClient();
    mockCreate.mockResolvedValue(client as never);
    await GET(getRequest(VALID_PATH) as never);
    const storageFrom = (client.storage.from as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const createSignedUrl = (client.storage.from as ReturnType<typeof vi.fn>)
      .mock.results[0].value.createSignedUrl as ReturnType<typeof vi.fn>;
    expect(storageFrom).toBe("documents");
    expect(createSignedUrl).toHaveBeenCalledWith(VALID_PATH, 600); // 60 * 10 = 600 seconds
  });
});
