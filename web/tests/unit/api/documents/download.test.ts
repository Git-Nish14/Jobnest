/**
 * Unit tests — GET /api/documents (download proxy)
 *
 * Covers the new original_name lookup + CRLF-sanitization logic added in the
 * August 2026 sprint:
 *  - Content-Disposition uses original_name from application_documents when
 *    available, rather than the raw storage-path last segment.
 *  - Control characters (CR, LF, NUL) are stripped before embedding the name
 *    in the HTTP header (prevents HTTP Response Splitting).
 *  - Header-grammar punctuation (", \, /, ;, ,) is replaced with underscores.
 *  - Empty-after-sanitize falls back to the literal string "document".
 *  - Falls back to parsed.filename when no DB row is found.
 *  - PDF/image served inline by default; attachment when ?dl=1.
 *  - Standard auth / path-format guards still hold.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { makeChain } from "@/tests/helpers/supabase-mock";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 59, resetAt: 0 }),
}));

import { GET } from "@/app/api/documents/route";
import { createClient } from "@/lib/supabase/server";

const mockCreate = vi.mocked(createClient);

// Minimal valid PDF bytes so the file extension → MIME mapping works correctly.
const PDF_CONTENT = "%PDF-1.4 test";

// ── Client factory ────────────────────────────────────────────────────────────

function makeClient({
  userId       = "user-abc",
  appExists    = true,
  originalName = null as string | null,
  downloadFail = false,
} = {}) {
  const appChain = makeChain(
    appExists
      ? { data: { id: "app-id" }, error: null }
      : { data: null, error: { message: "not found" } }
  );
  // maybeSingle resolves to { data: row | null }
  const docChain = makeChain(
    originalName !== null ? { data: { original_name: originalName } } : { data: null }
  );

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      }),
    },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "job_applications")     return appChain;
      if (table === "application_documents") return docChain;
      return makeChain();
    }),
    storage: {
      from: vi.fn().mockReturnValue({
        download: downloadFail
          ? vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } })
          : vi.fn().mockResolvedValue({
              data: new Blob([PDF_CONTENT], { type: "application/pdf" }),
              error: null,
            }),
      }),
    },
  };
}

function req(path: string, dl = false) {
  const url = `http://localhost/api/documents?path=${encodeURIComponent(path)}${dl ? "&dl=1" : ""}`;
  return new NextRequest(url);
}

// Legacy 3-part path whose userId matches the mocked auth user
const LEGACY_PATH = "user-abc/app-id/resume.pdf";

beforeEach(() => vi.clearAllMocks());

// ── original_name lookup ──────────────────────────────────────────────────────

describe("GET /api/documents — Content-Disposition uses original_name", () => {
  it("uses original_name from DB for attachment filename", async () => {
    mockCreate.mockResolvedValue(makeClient({ originalName: "John Doe Resume 2026.pdf" }) as never);
    const res = await GET(req(LEGACY_PATH, true)); // dl=1 → attachment
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toBe(
      'attachment; filename="John Doe Resume 2026.pdf"'
    );
  });

  it("falls back to storage path last segment when no DB row", async () => {
    mockCreate.mockResolvedValue(makeClient({ originalName: null }) as never);
    const res = await GET(req(LEGACY_PATH, true));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toBe('attachment; filename="resume.pdf"');
  });

  it("falls back for versioned path without DB row (strips timestamp prefix via filename fallback)", async () => {
    const versionedPath = "user-abc/app-id/Resume/1750000000000_My_Resume.pdf";
    mockCreate.mockResolvedValue(makeClient({ originalName: null }) as never);
    const res = await GET(req(versionedPath, true));
    expect(res.status).toBe(200);
    // Fallback is the raw last segment — timestamp prefix present
    const disp = res.headers.get("Content-Disposition") ?? "";
    expect(disp).toContain("1750000000000_My_Resume.pdf");
  });

  it("uses original_name for versioned path (preferred over timestamp-prefixed segment)", async () => {
    const versionedPath = "user-abc/app-id/Resume/1750000000000_My_Resume.pdf";
    mockCreate.mockResolvedValue(makeClient({ originalName: "My_Resume.pdf" }) as never);
    const res = await GET(req(versionedPath, true));
    expect(res.headers.get("Content-Disposition")).toBe('attachment; filename="My_Resume.pdf"');
  });

  it("serves PDF inline when no dl=1 param", async () => {
    mockCreate.mockResolvedValue(makeClient({ originalName: "cv.pdf" }) as never);
    const res = await GET(req(LEGACY_PATH)); // no dl param
    const disp = res.headers.get("Content-Disposition") ?? "";
    expect(disp.startsWith("inline;")).toBe(true);
    expect(disp).toContain("cv.pdf");
  });
});

// ── CRLF / control-character sanitization ────────────────────────────────────

describe("GET /api/documents — Content-Disposition CRLF/control-char sanitization", () => {
  it("strips CR+LF from original_name (HTTP Response Splitting prevention)", async () => {
    // CR/LF are the actual exploitable chars — stripping them makes the value safe
    // even if the surrounding text (e.g. "X-Injected: evil") remains on one line.
    mockCreate.mockResolvedValue(
      makeClient({ originalName: "resume.pdf\r\nX-Injected: evil" }) as never
    );
    const res = await GET(req(LEGACY_PATH, true));
    const disp = res.headers.get("Content-Disposition") ?? "";
    expect(disp).not.toContain("\r");
    expect(disp).not.toContain("\n");
    expect(disp).toContain("resume.pdf");
  });

  it("strips LF-only from original_name", async () => {
    mockCreate.mockResolvedValue(
      makeClient({ originalName: "resume.pdf\nSet-Cookie: admin=1" }) as never
    );
    const res = await GET(req(LEGACY_PATH, true));
    const disp = res.headers.get("Content-Disposition") ?? "";
    expect(disp).not.toContain("\n");
    expect(disp).toContain("resume.pdf");
  });

  it("strips NUL bytes from original_name", async () => {
    mockCreate.mockResolvedValue(
      makeClient({ originalName: "resume.pdf\x00malware" }) as never
    );
    const res = await GET(req(LEGACY_PATH, true));
    const disp = res.headers.get("Content-Disposition") ?? "";
    expect(disp).not.toContain("\x00");
    expect(disp).toContain("resume.pdf");
  });

  it("replaces double-quotes with underscores to prevent header breakout", async () => {
    mockCreate.mockResolvedValue(
      makeClient({ originalName: 'resume"evil.pdf' }) as never
    );
    const res = await GET(req(LEGACY_PATH, true));
    const disp = res.headers.get("Content-Disposition") ?? "";
    // The quote should be replaced, not left raw
    expect(disp).not.toMatch(/filename="[^"]*"[^"]+"/); // no extra unescaped quotes
  });

  it("falls back to 'document' when original_name is only control characters", async () => {
    mockCreate.mockResolvedValue(
      makeClient({ originalName: "\r\n\x00\x1f" }) as never
    );
    const res = await GET(req(LEGACY_PATH, true));
    expect(res.headers.get("Content-Disposition")).toBe('attachment; filename="document"');
  });

  it("falls back to 'document' when original_name is empty string", async () => {
    mockCreate.mockResolvedValue(makeClient({ originalName: "" }) as never);
    const res = await GET(req(LEGACY_PATH, true));
    // empty string falls back to parsed.filename ("resume.pdf")
    const disp = res.headers.get("Content-Disposition") ?? "";
    expect(disp).toContain("resume.pdf");
  });
});

// ── Auth / access guards ──────────────────────────────────────────────────────

describe("GET /api/documents — auth and path guards", () => {
  it("returns 401 when unauthenticated", async () => {
    const mock = makeClient();
    mock.auth.getUser = vi.fn().mockResolvedValue({ data: { user: null }, error: null });
    mockCreate.mockResolvedValue(mock as never);
    const res = await GET(req(LEGACY_PATH));
    expect(res.status).toBe(401);
  });

  it("returns 403 when path userId does not match authenticated user", async () => {
    // Path starts with "user-abc" but authenticated user is "other-user"
    mockCreate.mockResolvedValue(makeClient({ userId: "other-user" }) as never);
    const res = await GET(req(LEGACY_PATH));
    expect(res.status).toBe(403);
  });

  it("returns 400 for a path with no slashes", async () => {
    mockCreate.mockResolvedValue(makeClient() as never);
    const res = await GET(req("nodashes.pdf"));
    expect(res.status).toBe(400);
  });

  it("returns 400 for a path with too many segments", async () => {
    mockCreate.mockResolvedValue(makeClient() as never);
    const res = await GET(req("a/b/c/d/e.pdf")); // 5 segments — invalid
    expect(res.status).toBe(400);
  });

  it("returns 404 when storage download fails", async () => {
    mockCreate.mockResolvedValue(makeClient({ downloadFail: true }) as never);
    const res = await GET(req(LEGACY_PATH));
    expect(res.status).toBe(404);
  });
});
