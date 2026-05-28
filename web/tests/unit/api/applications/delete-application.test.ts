/**
 * Unit tests — DELETE /api/applications/:id
 *
 * Covers:
 *  - 403 when Origin check fails
 *  - 401 when not authenticated
 *  - 429 when rate limited
 *  - 404 when application doesn't belong to authenticated user
 *  - 500 when the DELETE query fails
 *  - 200 happy path — storage paths collected and removed, row deleted
 *  - Storage paths filtered to only those starting with the user's ID
 *  - Legacy resume_path / cover_letter_path also included in storage removal
 *  - Storage remove failure is non-fatal (delete still proceeds)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { makeChain } from "@/tests/helpers/supabase-mock";

vi.mock("@/lib/supabase/server",  () => ({ createClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/security/csrf",    () => ({ verifyOrigin: vi.fn().mockReturnValue(true) }));

import { DELETE } from "@/app/api/applications/[id]/route";
import { createClient }  from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyOrigin }  from "@/lib/security/csrf";

const mockCreate       = vi.mocked(createClient);
const mockRL           = vi.mocked(checkRateLimit);
const mockVerifyOrigin = vi.mocked(verifyOrigin);

const USER_ID = "uid-1";
const APP_ID  = "app-abc";

function makeReq(applicationId: string) {
  return new NextRequest(`http://localhost/api/applications/${applicationId}`, {
    method: "DELETE",
  });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

interface ClientOpts {
  user?:        { id: string } | null;
  appRow?:      unknown;
  docRows?:     { storage_path: string }[];
  legacyPaths?: { resume_path: string | null; cover_letter_path: string | null };
  deleteError?: { message: string } | null;
  storageError?: { message: string } | null;
}

function makeClient(opts: ClientOpts = {}) {
  const {
    user        = { id: USER_ID },
    appRow      = { id: APP_ID },
    docRows     = [{ storage_path: `${USER_ID}/app/Resume/ts_file.pdf` }],
    legacyPaths = { resume_path: null, cover_letter_path: null },
    deleteError = null,
    storageError = null,
  } = opts;

  const storageRemove = vi.fn().mockResolvedValue({ error: storageError });

  // Track per-table calls
  let singleCallCount = 0;

  const fromFn = vi.fn().mockImplementation((table: string) => {
    if (table === "application_documents") {
      const chain = makeChain({ data: docRows, error: null });
      chain.then = (resolve: (v: unknown) => void) =>
        Promise.resolve({ data: docRows, error: null }).then(resolve);
      return chain;
    }

    if (table === "job_applications") {
      singleCallCount++;
      // Call 1 = ownership check; Call 2 = legacy path fetch; Call 3 = DELETE
      if (singleCallCount === 1) {
        return {
          ...makeChain({ data: appRow, error: appRow ? null : { message: "not found" } }),
          single: vi.fn().mockResolvedValue({ data: appRow, error: appRow ? null : { message: "not found" } }),
        };
      }
      if (singleCallCount === 2) {
        return {
          ...makeChain({ data: legacyPaths, error: null }),
          single: vi.fn().mockResolvedValue({ data: legacyPaths, error: null }),
        };
      }
      // Delete call
      return {
        ...makeChain({ data: null, error: deleteError }),
        then: (resolve: (v: unknown) => void) =>
          Promise.resolve({ data: null, error: deleteError }).then(resolve),
      };
    }

    return makeChain({ data: null, error: null });
  });

  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: user ? null : { message: "no user" } }) },
    from: fromFn,
    storage: { from: vi.fn().mockReturnValue({ remove: storageRemove }) },
    _storageRemove: storageRemove,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyOrigin.mockReturnValue(true);
  mockRL.mockReturnValue({ allowed: true, remaining: 29, resetAt: Date.now() + 60_000 });
});

// ── Auth & validation ─────────────────────────────────────────────────────────

describe("DELETE /api/applications/:id — auth & validation", () => {
  it("returns 403 when Origin check fails", async () => {
    mockVerifyOrigin.mockReturnValueOnce(false);
    mockCreate.mockResolvedValue(makeClient() as never);

    const res = await DELETE(makeReq(APP_ID), makeParams(APP_ID));
    expect(res.status).toBe(403);
  });

  it("returns 401 when not authenticated", async () => {
    mockCreate.mockResolvedValue(makeClient({ user: null }) as never);

    const res = await DELETE(makeReq(APP_ID), makeParams(APP_ID));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockRL.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() });
    mockCreate.mockResolvedValue(makeClient() as never);

    const res = await DELETE(makeReq(APP_ID), makeParams(APP_ID));
    expect(res.status).toBe(429);
  });

  it("returns 404 when application doesn't belong to the user", async () => {
    mockCreate.mockResolvedValue(makeClient({ appRow: null }) as never);

    const res = await DELETE(makeReq(APP_ID), makeParams(APP_ID));
    expect(res.status).toBe(404);
  });
});

// ── Happy path ────────────────────────────────────────────────────────────────

describe("DELETE /api/applications/:id — happy path", () => {
  it("returns 200 with success=true", async () => {
    mockCreate.mockResolvedValue(makeClient() as never);

    const res  = await DELETE(makeReq(APP_ID), makeParams(APP_ID));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("calls storage.remove with document paths", async () => {
    const client = makeClient({
      docRows: [
        { storage_path: `${USER_ID}/app/Resume/ts_v1.pdf` },
        { storage_path: `${USER_ID}/app/CoverLetter/ts_cl.pdf` },
      ],
    });
    mockCreate.mockResolvedValue(client as never);

    await DELETE(makeReq(APP_ID), makeParams(APP_ID));

    expect(client._storageRemove).toHaveBeenCalledWith(
      expect.arrayContaining([
        `${USER_ID}/app/Resume/ts_v1.pdf`,
        `${USER_ID}/app/CoverLetter/ts_cl.pdf`,
      ])
    );
  });

  it("includes legacy resume_path and cover_letter_path in storage removal", async () => {
    const client = makeClient({
      docRows:     [],
      legacyPaths: {
        resume_path:       `${USER_ID}/app-old/resume.pdf`,
        cover_letter_path: `${USER_ID}/app-old/cover_letter.pdf`,
      },
    });
    mockCreate.mockResolvedValue(client as never);

    await DELETE(makeReq(APP_ID), makeParams(APP_ID));

    expect(client._storageRemove).toHaveBeenCalledWith(
      expect.arrayContaining([
        `${USER_ID}/app-old/resume.pdf`,
        `${USER_ID}/app-old/cover_letter.pdf`,
      ])
    );
  });

  it("filters out storage paths that don't start with the user's ID", async () => {
    const client = makeClient({
      docRows: [
        { storage_path: `${USER_ID}/app/Resume/good.pdf` },
        { storage_path: "OTHER_USER/app/Resume/evil.pdf" },
      ],
    });
    mockCreate.mockResolvedValue(client as never);

    await DELETE(makeReq(APP_ID), makeParams(APP_ID));

    const [[paths]] = client._storageRemove.mock.calls as [[string[]]];
    expect(paths).toContain(`${USER_ID}/app/Resume/good.pdf`);
    expect(paths).not.toContain("OTHER_USER/app/Resume/evil.pdf");
  });

  it("skips storage.remove when no paths exist", async () => {
    const client = makeClient({ docRows: [], legacyPaths: { resume_path: null, cover_letter_path: null } });
    mockCreate.mockResolvedValue(client as never);

    await DELETE(makeReq(APP_ID), makeParams(APP_ID));

    expect(client._storageRemove).not.toHaveBeenCalled();
  });

  it("proceeds with DB delete even when storage.remove fails (non-fatal)", async () => {
    const client = makeClient({ storageError: { message: "bucket unavailable" } });
    mockCreate.mockResolvedValue(client as never);

    const res  = await DELETE(makeReq(APP_ID), makeParams(APP_ID));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});

// ── DB error ──────────────────────────────────────────────────────────────────

describe("DELETE /api/applications/:id — DB error", () => {
  it("returns 500 when the DELETE query fails", async () => {
    const client = makeClient({ deleteError: { message: "foreign key violation" } });
    mockCreate.mockResolvedValue(client as never);

    const res = await DELETE(makeReq(APP_ID), makeParams(APP_ID));
    expect(res.status).toBe(500);
  });
});
