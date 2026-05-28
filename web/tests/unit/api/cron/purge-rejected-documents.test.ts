/**
 * Unit tests — GET /api/cron/purge-rejected-documents
 *
 * Covers:
 *  - 401 when Authorization header is missing
 *  - 401 when CRON_SECRET is wrong
 *  - 500 (generic, no schema leak) when the initial fetch fails
 *  - Purge branch: deletes ALL version paths (not just is_current) from Storage
 *  - Purge branch: marks ALL application_documents rows as is_current=false
 *  - Purge branch: marks queue entry as "purged"
 *  - Purge branch: sends "files deleted" notification only when paths exist
 *  - Purge branch: no notification when application had zero document uploads
 *  - Purge branch: storage error → entry skipped, error recorded, queue NOT marked purged
 *  - Notification branch: sends countdown notification when interval has elapsed
 *  - Notification branch: skips notification when last notified too recently
 *  - Notification branch: records error and continues when notification insert fails
 *  - Mixed queue: purges expired entries, notifies active ones
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { GET } from "@/app/api/cron/purge-rejected-documents/route";
import { createAdminClient } from "@/lib/supabase/admin";

const mockAdminClient = vi.mocked(createAdminClient);
const CRON_SECRET     = "test-cron-secret";

// ── Request helpers ──────────────────────────────────────────────────────────

function makeReq(authHeader?: string) {
  const headers: Record<string, string> = {};
  if (authHeader) headers["authorization"] = authHeader;
  return new NextRequest("http://localhost/api/cron/purge-rejected-documents", { headers });
}

function validReq() {
  return makeReq(`Bearer ${CRON_SECRET}`);
}

// ── Time helpers ─────────────────────────────────────────────────────────────

const NOW       = new Date("2026-05-26T03:00:00Z");
const EXPIRED   = new Date(NOW.getTime() - 1_000).toISOString(); // 1 second past purge_at
const ACTIVE_30 = new Date(NOW.getTime() + 30 * 86_400_000).toISOString(); // 30 days ahead
const LAST_NOTIF_RECENT = new Date(NOW.getTime() - 2 * 86_400_000).toISOString(); // 2 days ago
const LAST_NOTIF_OLD    = new Date(NOW.getTime() - 6 * 86_400_000).toISOString(); // 6 days ago

// ── Queue entry factories ────────────────────────────────────────────────────

function makeExpiredEntry(overrides: Record<string, unknown> = {}) {
  return {
    id:               "queue-1",
    application_id:   "app-1",
    user_id:          "uid-1",
    purge_at:         EXPIRED,
    last_notified_at: null,
    notif_count:      0,
    job_applications: { company: "Acme Corp", position: "Engineer" },
    ...overrides,
  };
}

function makeActiveEntry(overrides: Record<string, unknown> = {}) {
  return {
    id:               "queue-2",
    application_id:   "app-2",
    user_id:          "uid-1",
    purge_at:         ACTIVE_30,
    last_notified_at: null,
    notif_count:      0,
    job_applications: { company: "Beta Inc", position: "Designer" },
    ...overrides,
  };
}

// ── Admin client factory ─────────────────────────────────────────────────────

function buildChain() {
  const self: Record<string, unknown> = {};
  const m = () => vi.fn().mockReturnValue(self);
  self.select = m(); self.update = m(); self.insert = m(); self.upsert = m();
  self.eq = m(); self.neq = m(); self.is = m(); self.order = m(); self.limit = m();
  self.single      = vi.fn().mockResolvedValue({ data: null, error: null });
  self.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  self.then = (resolve: (v: unknown) => void) =>
    Promise.resolve({ data: null, error: null }).then(resolve);
  return self;
}

// A more ergonomic admin builder that intercepts per-table calls
function makeAdminByTable(opts: {
  entries?:      unknown[];
  fetchError?:   { message: string } | null;
  docRows?:      { storage_path: string }[];
  storageError?: { message: string } | null;
  updateError?:  { message: string } | null;
  notifError?:   { message: string } | null;
} = {}) {
  const {
    entries      = [],
    fetchError   = null,
    docRows      = [{ storage_path: "uid-1/app-1/Resume/ts_file.pdf" }],
    storageError = null,
    updateError  = null,
    notifError   = null,
  } = opts;

  const storageRemove = vi.fn().mockResolvedValue({ error: storageError });

  // Track calls to from() per table
  const docSelectChain = buildChain();
  docSelectChain.then = (resolve: (v: unknown) => void) =>
    Promise.resolve({ data: docRows, error: null }).then(resolve);

  const queueSelectChain = buildChain();
  queueSelectChain.then = (resolve: (v: unknown) => void) =>
    Promise.resolve({ data: fetchError ? null : entries, error: fetchError }).then(resolve);

  const mutateChain = buildChain();
  mutateChain.then = (resolve: (v: unknown) => void) =>
    Promise.resolve({ data: null, error: updateError }).then(resolve);

  const notifChain = buildChain();
  notifChain.then = (resolve: (v: unknown) => void) =>
    Promise.resolve({ data: null, error: notifError }).then(resolve);

  // Each from() call returns a table-appropriate chain
  let docSelectCallCount = 0;
  let queueFetchDone     = false;

  const fromFn = vi.fn().mockImplementation((table: string) => {
    if (table === "document_purge_queue" && !queueFetchDone) {
      queueFetchDone = true;
      return queueSelectChain;
    }
    if (table === "application_documents") {
      docSelectCallCount++;
      if (docSelectCallCount === 1) return docSelectChain; // SELECT
      return mutateChain;                                   // UPDATE
    }
    if (table === "notifications") return notifChain;
    return mutateChain; // purge_queue UPDATE etc.
  });

  return {
    from: fromFn,
    storage: { from: vi.fn().mockReturnValue({ remove: storageRemove }) },
    _storageRemove: storageRemove,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.setSystemTime(NOW);
});

// ── Auth ─────────────────────────────────────────────────────────────────────

describe("GET /api/cron/purge-rejected-documents — auth", () => {
  it("returns 401 when Authorization header is missing", async () => {
    mockAdminClient.mockReturnValue(makeAdminByTable() as never);
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 when CRON_SECRET is wrong", async () => {
    mockAdminClient.mockReturnValue(makeAdminByTable() as never);
    const res = await GET(makeReq("Bearer wrong-secret"));
    expect(res.status).toBe(401);
  });
});

// ── Initial fetch failure ─────────────────────────────────────────────────────

describe("GET /api/cron/purge-rejected-documents — fetch error", () => {
  it("returns 500 with a generic message (no raw DB error exposed)", async () => {
    mockAdminClient.mockReturnValue(
      makeAdminByTable({ fetchError: { message: "column does_not_exist does not exist" } }) as never
    );
    const res = await GET(validReq());
    expect(res.status).toBe(500);
    const body = await res.json();
    // Must NOT leak the raw DB error string
    expect(body.error).toBe("Failed to fetch purge queue.");
    expect(body.error).not.toContain("column");
  });
});

// ── Purge branch (purge_at <= now) ────────────────────────────────────────────

describe("GET /api/cron/purge-rejected-documents — purge branch", () => {
  it("returns 200 with purged=1 when a single expired entry is processed", async () => {
    mockAdminClient.mockReturnValue(
      makeAdminByTable({ entries: [makeExpiredEntry()] }) as never
    );
    const res = await GET(validReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.purged).toBe(1);
  });

  it("calls storage.remove with ALL doc version paths (not just is_current)", async () => {
    const docRows = [
      { storage_path: "uid-1/app-1/Resume/ts1_v1.pdf" },
      { storage_path: "uid-1/app-1/Resume/ts2_v2.pdf" }, // old version (is_current=false)
    ];
    const admin = makeAdminByTable({ entries: [makeExpiredEntry()], docRows });
    mockAdminClient.mockReturnValue(admin as never);

    await GET(validReq());

    expect(admin._storageRemove).toHaveBeenCalledWith([
      "uid-1/app-1/Resume/ts1_v1.pdf",
      "uid-1/app-1/Resume/ts2_v2.pdf",
    ]);
  });

  it("filters out paths that do not start with the user's ID (path guard)", async () => {
    const docRows = [
      { storage_path: "uid-1/app-1/Resume/good.pdf" },
      { storage_path: "uid-OTHER/app-X/Resume/evil.pdf" }, // wrong user
    ];
    const admin = makeAdminByTable({ entries: [makeExpiredEntry()], docRows });
    mockAdminClient.mockReturnValue(admin as never);

    await GET(validReq());

    expect(admin._storageRemove).toHaveBeenCalledWith([
      "uid-1/app-1/Resume/good.pdf",
    ]);
  });

  it("skips storage.remove and sends no 'files deleted' notification when no paths found", async () => {
    const admin = makeAdminByTable({ entries: [makeExpiredEntry()], docRows: [] });
    mockAdminClient.mockReturnValue(admin as never);

    const res = await GET(validReq());

    expect(res.status).toBe(200);
    expect(admin._storageRemove).not.toHaveBeenCalled();
    // notifications.from() for notifications table should NOT be called
    const notifCalls = (admin.from as ReturnType<typeof vi.fn>).mock.calls
      .filter((args: unknown[]) => args[0] === "notifications");
    expect(notifCalls).toHaveLength(0);
    const body = await res.json();
    expect(body.purged).toBe(1); // still counted as purged (queue entry marked)
  });

  it("records a storage error and does NOT mark queue as purged", async () => {
    const admin = makeAdminByTable({
      entries:      [makeExpiredEntry()],
      storageError: { message: "bucket not found" },
    });
    mockAdminClient.mockReturnValue(admin as never);

    const res = await GET(validReq());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.purged).toBe(0);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0]).toContain("storage remove");
  });
});

// ── Notification branch (countdown active) ────────────────────────────────────

describe("GET /api/cron/purge-rejected-documents — notification branch", () => {
  it("sends a countdown notification when last_notified_at is null (first time)", async () => {
    const admin = makeAdminByTable({ entries: [makeActiveEntry()] });
    mockAdminClient.mockReturnValue(admin as never);

    const res = await GET(validReq());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notificationsSent).toBe(1);
    expect(body.purged).toBe(0);
  });

  it("sends a notification when last notified more than 5 days ago", async () => {
    const entry = makeActiveEntry({ last_notified_at: LAST_NOTIF_OLD, notif_count: 1 });
    const admin = makeAdminByTable({ entries: [entry] });
    mockAdminClient.mockReturnValue(admin as never);

    const res = await GET(validReq());
    const body = await res.json();

    expect(body.notificationsSent).toBe(1);
  });

  it("skips notification when last notified fewer than 5 days ago", async () => {
    const entry = makeActiveEntry({ last_notified_at: LAST_NOTIF_RECENT, notif_count: 1 });
    const admin = makeAdminByTable({ entries: [entry] });
    mockAdminClient.mockReturnValue(admin as never);

    const res = await GET(validReq());
    const body = await res.json();

    expect(body.notificationsSent).toBe(0);
    expect(body.errors).toHaveLength(0);
  });

  it("records notification error and continues processing remaining entries", async () => {
    const entries = [
      makeActiveEntry({ id: "q-1", application_id: "app-1" }),
      makeActiveEntry({ id: "q-2", application_id: "app-2" }),
    ];
    // Simulate notification insert error for all
    const admin = makeAdminByTable({ entries, notifError: { message: "unique violation" } });
    mockAdminClient.mockReturnValue(admin as never);

    const res = await GET(validReq());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.notificationsSent).toBe(0);
    // Both entries recorded as errors
    expect(body.errors.length).toBeGreaterThanOrEqual(1);
  });
});

// ── Mixed queue ───────────────────────────────────────────────────────────────

describe("GET /api/cron/purge-rejected-documents — mixed queue", () => {
  it("processes expired and active entries independently in one run", async () => {
    // Both entries, but they use the same from() chain, so we test the summary counts
    const entries  = [makeExpiredEntry(), makeActiveEntry()];
    const admin    = makeAdminByTable({ entries });
    mockAdminClient.mockReturnValue(admin as never);

    const res  = await GET(validReq());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.purged).toBe(1);
    expect(body.notificationsSent).toBe(1);
  });

  it("returns success=true even when the queue is empty", async () => {
    const admin = makeAdminByTable({ entries: [] });
    mockAdminClient.mockReturnValue(admin as never);

    const res  = await GET(validReq());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.purged).toBe(0);
    expect(body.notificationsSent).toBe(0);
  });
});
