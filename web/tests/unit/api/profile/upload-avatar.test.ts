/**
 * Unit tests — POST /api/profile/upload-avatar
 *
 * Covers:
 *  - 403 when verifyOrigin fails (CSRF)
 *  - 401 when user is not authenticated
 *  - 429 when rate limit is exceeded
 *  - 400 when FormData has no avatar field
 *  - 400 when file size is 0
 *  - 400 when file MIME type is not jpeg/png/webp
 *  - 400 when file exceeds 2 MB
 *  - 400 when magic bytes don't match any valid image format (content-type spoofing)
 *  - 500 when storage upload fails
 *  - 500 when signed URL generation fails
 *  - 500 when supabase.auth.updateUser fails
 *  - 200 success — returns avatarUrl, storage path uses correct extension per mime
 *  - 200 PNG upload → storage path ends with .png
 *  - 200 WebP upload → storage path ends with .webp
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/security/csrf",       () => ({ verifyOrigin: vi.fn().mockReturnValue(true) }));
vi.mock("@/lib/supabase/server",     () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin",      () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: vi.fn() }));

import { POST } from "@/app/api/profile/upload-avatar/route";
import { verifyOrigin }      from "@/lib/security/csrf";
import { createClient }      from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit }    from "@/lib/security/rate-limit";

const mockVerifyOrigin = vi.mocked(verifyOrigin);
const mockCreateClient = vi.mocked(createClient);
const mockAdminClient  = vi.mocked(createAdminClient);
const mockRL           = vi.mocked(checkRateLimit);

const USER = { id: "uid-avatar-1", email: "user@test.com", user_metadata: { display_name: "Test" } };

// ── JPEG magic bytes (2 bytes is enough to detect)
const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(100).fill(0x00)]);
// ── PNG magic bytes
const PNG_BYTES  = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(100).fill(0x00)]);
// ── WebP magic bytes: RIFF....WEBP
const WEBP_BYTES = new Uint8Array([
  0x52, 0x49, 0x46, 0x46,  // RIFF
  0x00, 0x00, 0x00, 0x00,  // file size (ignored)
  0x57, 0x45, 0x42, 0x50,  // WEBP
  ...new Array(100).fill(0x00),
]);
// ── GIF magic bytes (invalid — not allowed)
const GIF_BYTES  = new Uint8Array([0x47, 0x49, 0x46, 0x38, ...new Array(100).fill(0x00)]);

function makeFile(bytes: Uint8Array, mimeType = "image/jpeg"): File {
  const blob = new Blob([bytes], { type: mimeType });
  return new File([blob], "photo.jpg", { type: mimeType });
}

/** Creates a real file larger than the 2 MB server limit with valid JPEG magic bytes. */
function makeOversizedFile(): File {
  const buf = new Uint8Array(2 * 1024 * 1024 + 100);
  buf[0] = 0xff; buf[1] = 0xd8; // JPEG magic
  return makeFile(buf, "image/jpeg");
}

function makeFormData(file?: File, fieldName = "avatar"): FormData {
  const fd = new FormData();
  if (file) fd.append(fieldName, file);
  return fd;
}

function makeReq(formData: FormData, origin = "http://localhost:3000"): NextRequest {
  return new NextRequest("http://localhost/api/profile/upload-avatar", {
    method: "POST",
    headers: { origin },
    body: formData,
  });
}

function makeSupabase(user: unknown = USER) {
  return {
    auth: {
      getUser:    vi.fn().mockResolvedValue({ data: { user }, error: null }),
      updateUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
    },
  };
}

function makeAdmin(overrides?: {
  uploadError?: string;
  signedUrl?: string | null;
  signError?: boolean;
}) {
  return {
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({
          data:  overrides?.uploadError ? null : {},
          error: overrides?.uploadError ? { message: overrides.uploadError } : null,
        }),
        createSignedUrl: vi.fn().mockResolvedValue({
          data:  overrides?.signError ? null : { signedUrl: overrides?.signedUrl ?? "https://cdn.supabase.co/signed-url" },
          error: overrides?.signError ? { message: "sign error" } : null,
        }),
      }),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyOrigin.mockReturnValue(true);
  mockRL.mockReturnValue({ allowed: true, remaining: 9, resetTime: Date.now() + 60_000 });
  mockCreateClient.mockResolvedValue(makeSupabase() as never);
  mockAdminClient.mockReturnValue(makeAdmin() as never);
});

// ── CSRF ─────────────────────────────────────────────────────────────────────

describe("POST /api/profile/upload-avatar — CSRF", () => {
  it("returns 403 when verifyOrigin fails", async () => {
    mockVerifyOrigin.mockReturnValue(false);
    const res = await POST(makeReq(makeFormData()));
    expect(res.status).toBe(403);
  });
});

// ── Auth ─────────────────────────────────────────────────────────────────────

describe("POST /api/profile/upload-avatar — auth", () => {
  it("returns 401 when user is not authenticated", async () => {
    mockCreateClient.mockResolvedValue(makeSupabase(null) as never);
    const res = await POST(makeReq(makeFormData(makeFile(JPEG_BYTES))));
    expect(res.status).toBe(401);
  });
});

// ── Rate limit ────────────────────────────────────────────────────────────────

describe("POST /api/profile/upload-avatar — rate limit", () => {
  it("returns 429 when rate limit is exceeded", async () => {
    mockRL.mockReturnValue({ allowed: false, remaining: 0, resetTime: Date.now() + 60_000 });
    const res = await POST(makeReq(makeFormData(makeFile(JPEG_BYTES))));
    expect(res.status).toBe(429);
  });
});

// ── Input validation ──────────────────────────────────────────────────────────

describe("POST /api/profile/upload-avatar — input validation", () => {
  it("returns 400 when FormData has no avatar field", async () => {
    const res = await POST(makeReq(makeFormData()));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/no image file/i);
  });

  it("returns 400 when avatar file size is 0", async () => {
    const res = await POST(makeReq(makeFormData(makeFile(new Uint8Array(0), "image/jpeg", 0))));
    expect(res.status).toBe(400);
  });

  it("returns 400 when MIME type is not jpeg/png/webp (gif)", async () => {
    const res = await POST(makeReq(makeFormData(makeFile(GIF_BYTES, "image/gif"))));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/jpeg|png|webp/i);
  });

  it("returns 400 when file exceeds 2 MB", async () => {
    const res = await POST(makeReq(makeFormData(makeOversizedFile())));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/2 mb/i);
  });

  it("returns 400 when magic bytes don't match stated MIME (content-type spoofing: gif bytes claimed as jpeg)", async () => {
    // Attacker sends a GIF but claims it's a JPEG
    const res = await POST(makeReq(makeFormData(makeFile(GIF_BYTES, "image/jpeg"))));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/file content|image format/i);
  });
});

// ── Storage / upstream errors ─────────────────────────────────────────────────

describe("POST /api/profile/upload-avatar — upstream errors", () => {
  it("returns 500 when Supabase storage upload fails", async () => {
    mockAdminClient.mockReturnValue(makeAdmin({ uploadError: "bucket full" }) as never);
    const res = await POST(makeReq(makeFormData(makeFile(JPEG_BYTES))));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/upload failed/i);
  });

  it("returns 500 when createSignedUrl fails", async () => {
    mockAdminClient.mockReturnValue(makeAdmin({ signError: true }) as never);
    const res = await POST(makeReq(makeFormData(makeFile(JPEG_BYTES))));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/url/i);
  });

  it("returns 500 when supabase.auth.updateUser fails", async () => {
    const supabase = {
      ...makeSupabase(),
      auth: {
        getUser:    vi.fn().mockResolvedValue({ data: { user: USER }, error: null }),
        updateUser: vi.fn().mockResolvedValue({ data: null, error: { message: "metadata write failed" } }),
      },
    };
    mockCreateClient.mockResolvedValue(supabase as never);
    const res = await POST(makeReq(makeFormData(makeFile(JPEG_BYTES))));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/save avatar/i);
  });
});

// ── Happy path ────────────────────────────────────────────────────────────────

describe("POST /api/profile/upload-avatar — happy path", () => {
  it("returns 200 with avatarUrl on valid JPEG upload", async () => {
    const res = await POST(makeReq(makeFormData(makeFile(JPEG_BYTES))));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.avatarUrl).toBe("https://cdn.supabase.co/signed-url");
  });

  it("storage path ends with .jpg for JPEG magic bytes", async () => {
    const admin = makeAdmin();
    mockAdminClient.mockReturnValue(admin as never);
    await POST(makeReq(makeFormData(makeFile(JPEG_BYTES, "image/jpeg"))));
    const uploadCall = vi.mocked(admin.storage.from("documents").upload).mock.calls[0];
    expect(uploadCall?.[0]).toMatch(/profile\.jpg$/);
  });

  it("storage path ends with .png for PNG magic bytes", async () => {
    const admin = makeAdmin();
    mockAdminClient.mockReturnValue(admin as never);
    await POST(makeReq(makeFormData(makeFile(PNG_BYTES, "image/png"))));
    const uploadCall = vi.mocked(admin.storage.from("documents").upload).mock.calls[0];
    expect(uploadCall?.[0]).toMatch(/profile\.png$/);
  });

  it("storage path ends with .webp for WebP magic bytes", async () => {
    const admin = makeAdmin();
    mockAdminClient.mockReturnValue(admin as never);
    await POST(makeReq(makeFormData(makeFile(WEBP_BYTES, "image/webp"))));
    const uploadCall = vi.mocked(admin.storage.from("documents").upload).mock.calls[0];
    expect(uploadCall?.[0]).toMatch(/profile\.webp$/);
  });

  it("storage path is scoped to user id", async () => {
    const admin = makeAdmin();
    mockAdminClient.mockReturnValue(admin as never);
    await POST(makeReq(makeFormData(makeFile(JPEG_BYTES))));
    const uploadCall = vi.mocked(admin.storage.from("documents").upload).mock.calls[0];
    expect(uploadCall?.[0]).toMatch(new RegExp(`^${USER.id}/avatar/`));
  });

  it("uses upsert:true so re-uploading same mime type overwrites", async () => {
    const admin = makeAdmin();
    mockAdminClient.mockReturnValue(admin as never);
    await POST(makeReq(makeFormData(makeFile(JPEG_BYTES))));
    const uploadCall = vi.mocked(admin.storage.from("documents").upload).mock.calls[0];
    expect(uploadCall?.[2]).toMatchObject({ upsert: true });
  });

  it("saves signed URL to user_metadata.avatar_url via updateUser", async () => {
    const supabase = makeSupabase();
    mockCreateClient.mockResolvedValue(supabase as never);
    await POST(makeReq(makeFormData(makeFile(JPEG_BYTES))));
    expect(vi.mocked(supabase.auth.updateUser)).toHaveBeenCalledWith({
      data: { avatar_url: "https://cdn.supabase.co/signed-url" },
    });
  });
});
