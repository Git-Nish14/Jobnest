/**
 * Unit tests — GET /api/cron/orphan-cleanup
 *
 * Covers:
 *   - 401 when Authorization header is missing
 *   - 401 when wrong secret is provided
 *   - 200 with ok: true when no storage objects exist
 *   - 200 with correct orphan count when all storage objects have DB rows
 *   - 200 with orphans_found > 0 when storage paths not in DB
 *   - Purge mode (purge=true): calls storage.remove with orphan paths
 *   - Purge mode: does NOT call remove when no orphans found
 *   - Report mode (default): does NOT call storage.remove even with orphans
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { makeChain } from "@/tests/helpers/supabase-mock";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { GET } from "@/app/api/cron/orphan-cleanup/route";
import { createAdminClient } from "@/lib/supabase/admin";

const mockAdminClient = vi.mocked(createAdminClient);
const CRON_SECRET = "test-cron-secret";

function makeGetRequest(auth: string | null = `Bearer ${CRON_SECRET}`, purge = false): NextRequest {
  const url = new URL(`http://localhost/api/cron/orphan-cleanup${purge ? "?purge=true" : ""}`);
  const headers: Record<string, string> = {};
  if (auth) headers["authorization"] = auth;
  return new NextRequest(url, { headers });
}

/**
 * The listAllObjects function traverses a folder tree via supabase.storage.from().list(prefix).
 * For a flat test, we mock the list() at prefix="" to return items where:
 *   - `id` is truthy → treated as a file (not a folder, no recursion)
 *   - `name` is the full storage path (since prefix="" → final path = item.name)
 * This avoids the need to simulate recursive folder traversal.
 */
function makeStorageItem(fullPath: string) {
  return { name: fullPath, id: "file-id", metadata: { size: 1024 } };
}

function makeAdmin({
  storageObjects = [] as string[],
  dbPaths        = [] as string[],
} = {}) {
  const mockRemove = vi.fn().mockResolvedValue({ error: null });

  const dbChain = makeChain({
    data: dbPaths.map((p) => ({ storage_path: p, size_bytes: 1024 })),
    error: null,
  });

  return {
    from: vi.fn(() => dbChain),
    storage: {
      from: vi.fn(() => ({
        // list() always returns flat items with full path as name; id=truthy means file not folder
        list: vi.fn().mockResolvedValue({
          data: storageObjects.map(makeStorageItem),
          error: null,
        }),
        remove: mockRemove,
      })),
    },
    _mockRemove: mockRemove,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/cron/orphan-cleanup — auth", () => {
  it("returns 401 when Authorization header is missing", async () => {
    mockAdminClient.mockReturnValue(makeAdmin() as never);
    const res = await GET(makeGetRequest(null));
    expect(res.status).toBe(401);
  });

  it("returns 401 when wrong secret provided", async () => {
    mockAdminClient.mockReturnValue(makeAdmin() as never);
    const res = await GET(makeGetRequest("Bearer wrong-secret"));
    expect(res.status).toBe(401);
  });

  it("returns 401 with missing Bearer prefix", async () => {
    mockAdminClient.mockReturnValue(makeAdmin() as never);
    const res = await GET(makeGetRequest(CRON_SECRET));
    expect(res.status).toBe(401);
  });
});

describe("GET /api/cron/orphan-cleanup — no storage objects", () => {
  it("returns 200 with ok: true when bucket is empty", async () => {
    mockAdminClient.mockReturnValue(makeAdmin({ storageObjects: [], dbPaths: [] }) as never);
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.orphans_found).toBe(0);
  });
});

describe("GET /api/cron/orphan-cleanup — report mode (no purge)", () => {
  it("returns 0 orphans when all storage paths exist in DB", async () => {
    const paths = ["uid-1/app-1/Resume/v1_resume.pdf", "uid-1/app-1/CL/v1_cl.pdf"];
    const admin = makeAdmin({ storageObjects: paths, dbPaths: paths });
    mockAdminClient.mockReturnValue(admin as never);
    const res = await GET(makeGetRequest());
    const body = await res.json();
    expect(body.orphans_found).toBe(0);
    expect(admin._mockRemove).not.toHaveBeenCalled();
  });

  it("reports orphans_found > 0 when storage has paths not in DB", async () => {
    const admin = makeAdmin({
      storageObjects: ["uid-1/app-1/Resume/old.pdf", "uid-1/app-1/Resume/new.pdf"],
      dbPaths:        ["uid-1/app-1/Resume/new.pdf"],
    });
    mockAdminClient.mockReturnValue(admin as never);
    const res = await GET(makeGetRequest());
    const body = await res.json();
    expect(body.orphans_found).toBe(1);
    expect(admin._mockRemove).not.toHaveBeenCalled();
  });
});

describe("GET /api/cron/orphan-cleanup — purge mode", () => {
  it("calls storage.remove with orphan paths when purge=true", async () => {
    const admin = makeAdmin({
      storageObjects: ["uid-1/app-1/Resume/orphan.pdf"],
      dbPaths:        [],
    });
    mockAdminClient.mockReturnValue(admin as never);
    const res = await GET(makeGetRequest(`Bearer ${CRON_SECRET}`, true));
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.orphans_found).toBe(1);
    expect(admin._mockRemove).toHaveBeenCalledTimes(1);
    expect(body.purged).toBe(1);
  });

  it("does not call storage.remove when no orphans exist in purge mode", async () => {
    const paths = ["uid-1/app-1/Resume/v1.pdf"];
    const admin = makeAdmin({ storageObjects: paths, dbPaths: paths });
    mockAdminClient.mockReturnValue(admin as never);
    const res = await GET(makeGetRequest(`Bearer ${CRON_SECRET}`, true));
    const body = await res.json();
    expect(body.orphans_found).toBe(0);
    expect(admin._mockRemove).not.toHaveBeenCalled();
    expect(body.purged).toBe(0);
  });

  it("report mode never calls remove even when orphans exist", async () => {
    const admin = makeAdmin({
      storageObjects: ["uid-1/orphan1.pdf", "uid-1/orphan2.pdf"],
      dbPaths:        [],
    });
    mockAdminClient.mockReturnValue(admin as never);
    await GET(makeGetRequest());
    expect(admin._mockRemove).not.toHaveBeenCalled();
  });
});
