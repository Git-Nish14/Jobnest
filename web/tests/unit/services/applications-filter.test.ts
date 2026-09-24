/**
 * Unit tests — services/applications.ts internal security helpers
 *
 * Tests filter sanitization and numbered pagination by examining what gets
 * passed to the Supabase query builder.
 *
 * Pattern: mock createClient(), call the exported service function,
 * and inspect the .or() / .ilike() / .eq() calls.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeChain } from "@/tests/helpers/supabase-mock";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { getApplicationsPage, getApplications } from "@/services/applications";
import { createClient } from "@/lib/supabase/server";

const mockCreate = vi.mocked(createClient);

function makeClient(result: unknown = { data: [], error: null }) {
  const chain = makeChain(result);
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "uid-1" } }, error: null }) },
    from: vi.fn().mockReturnValue(chain),
    _chain: chain,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── sanitizeFilterTerm — search ──────────────────────────────────────────────

describe("getApplicationsPage — search sanitization", () => {
  it("passes a clean search term to .or() without modification", async () => {
    const client = makeClient();
    mockCreate.mockResolvedValue(client as never);

    await getApplicationsPage({ search: "Google Engineer" });

    const orFn = (client._chain as { or: ReturnType<typeof vi.fn> }).or;
    expect(orFn).toHaveBeenCalledOnce();
    const filterStr = orFn.mock.calls[0][0] as string;
    expect(filterStr).toContain("Google Engineer");
  });

  it("strips commas from search term before .or() to prevent PostgREST injection", async () => {
    const client = makeClient();
    mockCreate.mockResolvedValue(client as never);

    await getApplicationsPage({ search: "foo,user_id.eq.victim" });

    const orFn = (client._chain as { or: ReturnType<typeof vi.fn> }).or;
    const filterStr = orFn.mock.calls[0][0] as string;
    // Comma must be gone from the filter string
    expect(filterStr).not.toContain(",user_id.eq.victim");
    // Only the sanitized search text should appear after ilike.%
    expect(filterStr).toMatch(/ilike\.%foo\s/);
  });

  it("strips parentheses from search term", async () => {
    const client = makeClient();
    mockCreate.mockResolvedValue(client as never);

    await getApplicationsPage({ search: ")(nested" });

    const orFn = (client._chain as { or: ReturnType<typeof vi.fn> }).or;
    const filterStr = orFn.mock.calls[0][0] as string;
    expect(filterStr).not.toContain(")(");
  });

  it("truncates search terms exceeding 200 characters", async () => {
    const client = makeClient();
    mockCreate.mockResolvedValue(client as never);

    await getApplicationsPage({ search: "a".repeat(300) });

    const orFn = (client._chain as { or: ReturnType<typeof vi.fn> }).or;
    const filterStr = orFn.mock.calls[0][0] as string;
    // The injected value segment (between %...%) should be ≤ 200 chars
    const match = filterStr.match(/ilike\.%(.+?)%,/);
    if (match) expect(match[1].length).toBeLessThanOrEqual(200);
  });
});

// ── sanitizeFilterTerm — location ─────────────────────────────────────────────

describe("getApplicationsPage — location sanitization", () => {
  it("passes a clean location to .ilike() without modification", async () => {
    const client = makeClient();
    mockCreate.mockResolvedValue(client as never);

    await getApplicationsPage({ location: "San Francisco" });

    const ilikeFn = (client._chain as { ilike: ReturnType<typeof vi.fn> }).ilike;
    expect(ilikeFn).toHaveBeenCalledOnce();
    const [col, pattern] = ilikeFn.mock.calls[0] as [string, string];
    expect(col).toBe("location");
    expect(pattern).toContain("San Francisco");
  });

  it("strips commas from location before .ilike()", async () => {
    const client = makeClient();
    mockCreate.mockResolvedValue(client as never);

    await getApplicationsPage({ location: "NYC,user_id.eq.victim" });

    const ilikeFn = (client._chain as { ilike: ReturnType<typeof vi.fn> }).ilike;
    const [, pattern] = ilikeFn.mock.calls[0] as [string, string];
    expect(pattern).not.toContain(",user_id");
  });
});

// ── numbered pagination ──────────────────────────────────────────────────────

describe("getApplicationsPage — pagination", () => {
  it("requests an exact count and returns page metadata", async () => {
    const client = makeClient({ data: [{ id: "app-1" }], error: null, count: 51 });
    mockCreate.mockResolvedValue(client as never);

    const result = await getApplicationsPage({ page: 2 });

    const selectFn = (client._chain as { select: ReturnType<typeof vi.fn> }).select;
    expect(selectFn).toHaveBeenCalledWith("*", { count: "exact" });
    expect(result).toMatchObject({ total: 51, page: 2, pageSize: 25, totalPages: 3 });
  });

  it("requests the correct row range for the selected page", async () => {
    const client = makeClient();
    mockCreate.mockResolvedValue(client as never);

    await getApplicationsPage({ page: 3, pageSize: 10 });

    const rangeFn = (client._chain as { range: ReturnType<typeof vi.fn> }).range;
    expect(rangeFn).toHaveBeenCalledWith(20, 29);
  });

  it("normalizes invalid page values to page one", async () => {
    const client = makeClient();
    mockCreate.mockResolvedValue(client as never);

    await getApplicationsPage({ page: -4, pageSize: 10 });

    const rangeFn = (client._chain as { range: ReturnType<typeof vi.fn> }).range;
    expect(rangeFn).toHaveBeenCalledWith(0, 9);
  });

  it("uses the requested sort before applying the page range", async () => {
    const client = makeClient();
    mockCreate.mockResolvedValue(client as never);

    await getApplicationsPage({ sort: "company_asc" });

    const orderFn = (client._chain as { order: ReturnType<typeof vi.fn> }).order;
    expect(orderFn).toHaveBeenNthCalledWith(1, "company", { ascending: true });
    expect(orderFn).toHaveBeenNthCalledWith(2, "id", { ascending: true });
  });
});

// ── company_tier filter ───────────────────────────────────────────────────────

describe("getApplicationsPage — tier filter", () => {
  it("applies .eq('company_tier', ...) when tier param is set", async () => {
    const client = makeClient();
    mockCreate.mockResolvedValue(client as never);

    await getApplicationsPage({ tier: "FAANG" });

    const eqFn = (client._chain as { eq: ReturnType<typeof vi.fn> }).eq;
    const calls = eqFn.mock.calls as [string, string][];
    expect(calls.some(([k, v]) => k === "company_tier" && v === "FAANG")).toBe(true);
  });

  it("does not apply tier filter when tier is 'all'", async () => {
    const client = makeClient();
    mockCreate.mockResolvedValue(client as never);

    await getApplicationsPage({ tier: "all" });

    const eqFn = (client._chain as { eq: ReturnType<typeof vi.fn> }).eq;
    const calls = eqFn.mock.calls as [string, string][];
    expect(calls.some(([k]) => k === "company_tier")).toBe(false);
  });
});

// ── getApplications also applies sanitization ─────────────────────────────────

describe("getApplications — sanitization parity", () => {
  it("sanitizes search in getApplications the same way as getApplicationsPage", async () => {
    const client = makeClient();
    mockCreate.mockResolvedValue(client as never);

    await getApplications({ search: "foo,injection" });

    const orFn = (client._chain as { or: ReturnType<typeof vi.fn> }).or;
    const calls = orFn.mock.calls as string[][];
    const hasBadPayload = calls.some(([f]) => f?.includes(",injection"));
    expect(hasBadPayload).toBe(false);
  });
});
