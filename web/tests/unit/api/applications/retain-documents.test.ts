/**
 * Unit tests — POST /api/applications/:id/retain-documents
 *
 * Covers:
 *  - 403 when Origin is invalid
 *  - 401 when not authenticated
 *  - 400 when action is missing or invalid
 *  - 403 when application does not belong to authenticated user
 *  - 200 with action=retain → marks queue entry as "retained", no storage ops
 *  - 200 with action=library → copies current docs to master library, then retains
 *  - library action: skips docs whose storage_path doesn't start with user's ID
 *  - library action: continues (does not throw) when storage.copy() fails for a doc
 *  - 500 when purge queue update fails
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { makeChain } from "@/tests/helpers/supabase-mock";

vi.mock("@/lib/supabase/server",  () => ({ createClient:      vi.fn() }));
vi.mock("@/lib/supabase/admin",   () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/security/csrf",    () => ({ verifyOrigin: vi.fn().mockReturnValue(true) }));

import { POST } from "@/app/api/applications/[id]/retain-documents/route";
import { createClient }      from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyOrigin }      from "@/lib/security/csrf";

const mockCreateClient      = vi.mocked(createClient);
const mockCreateAdminClient = vi.mocked(createAdminClient);
const mockVerifyOrigin      = vi.mocked(verifyOrigin);

const USER_ID = "uid-1";
const APP_ID  = "app-abc";

// ── Request factory ───────────────────────────────────────────────────────────

function makeReq(applicationId: string, body: unknown) {
  return new NextRequest(`http://localhost/api/applications/${applicationId}/retain-documents`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
}

// ── Supabase client factories ─────────────────────────────────────────────────

function makeUserClient(user: { id: string } | null = { id: USER_ID }, appRow: unknown = { id: APP_ID, user_id: USER_ID }) {
  const appChain = {
    ...makeChain({ data: appRow, error: appRow ? null : { message: "not found" } }),
    single: vi.fn().mockResolvedValue({ data: appRow, error: appRow ? null : { message: "not found" } }),
  };
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: user ? null : { message: "Not authenticated" } }) },
    from: vi.fn().mockReturnValue(appChain),
  };
}

interface AdminOpts {
  docRows?:    unknown[];
  copyError?:  { message: string } | null;
  updateError?: { message: string } | null;
}

function makeAdminClient_(opts: AdminOpts = {}) {
  const {
    docRows     = [{ id: "doc-1", label: "Resume", storage_path: `${USER_ID}/app/Resume/ts_file.pdf`, mime_type: "application/pdf", size_bytes: 1024, original_name: "resume.pdf" }],
    copyError   = null,
    updateError = null,
  } = opts;

  const docSelectChain = {
    ...makeChain({ data: docRows, error: null }),
    // Override the terminal .then so it resolves with docRows
    then: (resolve: (v: unknown) => void) =>
      Promise.resolve({ data: docRows, error: null }).then(resolve),
  };

  const mutateChain = makeChain({ data: null, error: updateError });

  const storageCopy = vi.fn().mockResolvedValue({ error: copyError });

  const fromFn = vi.fn().mockImplementation((table: string) => {
    if (table === "application_documents") {
      return {
        ...docSelectChain,
        insert: vi.fn().mockReturnValue(makeChain({ data: { id: "doc-new" }, error: null })),
        update: vi.fn().mockReturnValue(mutateChain),
      };
    }
    // document_purge_queue UPDATE
    return mutateChain;
  });

  return {
    from: fromFn,
    storage: { from: vi.fn().mockReturnValue({ copy: storageCopy }) },
    _storageCopy: storageCopy,
  };
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyOrigin.mockReturnValue(true);
});

// ── Auth & validation ─────────────────────────────────────────────────────────

describe("POST /api/applications/:id/retain-documents — auth & validation", () => {
  it("returns 403 when Origin check fails", async () => {
    mockVerifyOrigin.mockReturnValueOnce(false);
    mockCreateClient.mockResolvedValue(makeUserClient() as never);
    mockCreateAdminClient.mockReturnValue(makeAdminClient_() as never);

    const res = await POST(makeReq(APP_ID, { action: "retain" }), makeParams(APP_ID));
    expect(res.status).toBe(403);
  });

  it("returns 401 when user is not authenticated", async () => {
    mockCreateClient.mockResolvedValue(makeUserClient(null) as never);
    mockCreateAdminClient.mockReturnValue(makeAdminClient_() as never);

    const res = await POST(makeReq(APP_ID, { action: "retain" }), makeParams(APP_ID));
    expect(res.status).toBe(401);
  });

  it("returns 422 when action is missing", async () => {
    mockCreateClient.mockResolvedValue(makeUserClient() as never);
    mockCreateAdminClient.mockReturnValue(makeAdminClient_() as never);

    const res = await POST(makeReq(APP_ID, {}), makeParams(APP_ID));
    expect(res.status).toBe(422); // Zod validation failure → 422 Unprocessable Entity
  });

  it("returns 422 when action is an invalid enum value", async () => {
    mockCreateClient.mockResolvedValue(makeUserClient() as never);
    mockCreateAdminClient.mockReturnValue(makeAdminClient_() as never);

    const res = await POST(makeReq(APP_ID, { action: "delete" }), makeParams(APP_ID));
    expect(res.status).toBe(422);
  });

  it("returns 403 when application does not belong to authenticated user", async () => {
    // appRow = null → the user doesn't own this application
    mockCreateClient.mockResolvedValue(makeUserClient({ id: USER_ID }, null) as never);
    mockCreateAdminClient.mockReturnValue(makeAdminClient_() as never);

    const res = await POST(makeReq(APP_ID, { action: "retain" }), makeParams(APP_ID));
    expect(res.status).toBe(403);
  });
});

// ── Retain action ─────────────────────────────────────────────────────────────

describe("POST /api/applications/:id/retain-documents — action=retain", () => {
  it("returns 200 with action=retain in body", async () => {
    mockCreateClient.mockResolvedValue(makeUserClient() as never);
    mockCreateAdminClient.mockReturnValue(makeAdminClient_() as never);

    const res  = await POST(makeReq(APP_ID, { action: "retain" }), makeParams(APP_ID));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.action).toBe("retain");
  });

  it("does NOT call storage.copy for action=retain", async () => {
    const admin = makeAdminClient_();
    mockCreateClient.mockResolvedValue(makeUserClient() as never);
    mockCreateAdminClient.mockReturnValue(admin as never);

    await POST(makeReq(APP_ID, { action: "retain" }), makeParams(APP_ID));

    expect(admin._storageCopy).not.toHaveBeenCalled();
  });

  it("returns 500 when the purge queue UPDATE fails", async () => {
    mockCreateClient.mockResolvedValue(makeUserClient() as never);
    mockCreateAdminClient.mockReturnValue(
      makeAdminClient_({ updateError: { message: "update failed" } }) as never
    );

    const res = await POST(makeReq(APP_ID, { action: "retain" }), makeParams(APP_ID));
    expect(res.status).toBe(500);
  });
});

// ── Library action ────────────────────────────────────────────────────────────

describe("POST /api/applications/:id/retain-documents — action=library", () => {
  it("returns 200 with action=library in body", async () => {
    mockCreateClient.mockResolvedValue(makeUserClient() as never);
    mockCreateAdminClient.mockReturnValue(makeAdminClient_() as never);

    const res  = await POST(makeReq(APP_ID, { action: "library" }), makeParams(APP_ID));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.action).toBe("library");
  });

  it("calls storage.copy for each current document", async () => {
    const admin = makeAdminClient_({
      docRows: [
        { id: "d1", label: "Resume",       storage_path: `${USER_ID}/app/Resume/ts_v1.pdf`,       mime_type: "application/pdf", size_bytes: 500, original_name: "resume.pdf" },
        { id: "d2", label: "Cover Letter", storage_path: `${USER_ID}/app/CoverLetter/ts_cl.pdf`,  mime_type: "application/pdf", size_bytes: 300, original_name: "cover.pdf" },
      ],
    });
    mockCreateClient.mockResolvedValue(makeUserClient() as never);
    mockCreateAdminClient.mockReturnValue(admin as never);

    await POST(makeReq(APP_ID, { action: "library" }), makeParams(APP_ID));

    expect(admin._storageCopy).toHaveBeenCalledTimes(2);
  });

  it("skips docs whose storage_path does not start with user ID", async () => {
    const admin = makeAdminClient_({
      docRows: [
        { id: "d1", label: "Resume", storage_path: `${USER_ID}/app/Resume/good.pdf`,      mime_type: "application/pdf", size_bytes: 500, original_name: "good.pdf" },
        { id: "d2", label: "Resume", storage_path: "OTHER_USER/app/Resume/malicious.pdf", mime_type: "application/pdf", size_bytes: 500, original_name: "evil.pdf" },
      ],
    });
    mockCreateClient.mockResolvedValue(makeUserClient() as never);
    mockCreateAdminClient.mockReturnValue(admin as never);

    await POST(makeReq(APP_ID, { action: "library" }), makeParams(APP_ID));

    // Only the doc with the correct user prefix should trigger a copy
    expect(admin._storageCopy).toHaveBeenCalledTimes(1);
    const [[srcPath]] = admin._storageCopy.mock.calls as [[string, string]];
    expect(srcPath).toContain(USER_ID);
    expect(srcPath).not.toContain("OTHER_USER");
  });

  it("continues to retain even when storage.copy() fails for a document", async () => {
    const admin = makeAdminClient_({ copyError: { message: "storage unavailable" } });
    mockCreateClient.mockResolvedValue(makeUserClient() as never);
    mockCreateAdminClient.mockReturnValue(admin as never);

    const res  = await POST(makeReq(APP_ID, { action: "library" }), makeParams(APP_ID));
    const body = await res.json();

    // Copy failure must not bubble up — the retain still succeeds
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("uses sanitised label and original_name in the destination path", async () => {
    const admin = makeAdminClient_({
      docRows: [{
        id:            "d1",
        label:         "My Resume!", // contains special chars
        storage_path:  `${USER_ID}/app/My_Resume_/ts_file.pdf`,
        mime_type:     "application/pdf",
        size_bytes:    512,
        original_name: "John Doe Resume 2026.pdf",
      }],
    });
    mockCreateClient.mockResolvedValue(makeUserClient() as never);
    mockCreateAdminClient.mockReturnValue(admin as never);

    await POST(makeReq(APP_ID, { action: "library" }), makeParams(APP_ID));

    const [[, destPath]] = admin._storageCopy.mock.calls as [[string, string]];
    // Must start with user ID
    expect(destPath).toMatch(new RegExp(`^${USER_ID}/library/`));
    // Label special chars must be sanitised
    expect(destPath).not.toContain("!");
    // Original name special chars (spaces) must be sanitised
    expect(destPath).not.toContain(" ");
  });
});
