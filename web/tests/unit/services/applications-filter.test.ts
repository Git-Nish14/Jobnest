/**
 * Unit tests — services/applications.ts internal security helpers
 *
 * Tests sanitizeFilterTerm (PostgREST injection prevention) and
 * decodeCursor (format-validation preventing filter injection) by
 * examining what gets passed to the Supabase query builder.
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

function makeClient() {
  const chain = makeChain({ data: [], error: null });
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

// ── decodeCursor — format validation ─────────────────────────────────────────

describe("getApplicationsPage — cursor validation", () => {
  it("applies cursor filter when cursor has valid date|uuid format", async () => {
    const client = makeClient();
    mockCreate.mockResolvedValue(client as never);

    const validCursor = btoa("2026-05-01|123e4567-e89b-12d3-a456-426614174000");
    await getApplicationsPage({ cursor: validCursor });

    // .or() called twice: once without cursor for base query? No — only once for cursor
    const orFn = (client._chain as { or: ReturnType<typeof vi.fn> }).or;
    // At least one .or() call should reference the cursor date
    const calls = orFn.mock.calls as string[][];
    const cursorCall = calls.find(([f]) => f?.includes("2026-05-01"));
    expect(cursorCall).toBeDefined();
  });

  it("ignores cursor when date portion has invalid format", async () => {
    const client = makeClient();
    mockCreate.mockResolvedValue(client as never);

    // Date has slashes instead of dashes — invalid
    const badCursor = btoa("2026/05/01|123e4567-e89b-12d3-a456-426614174000");
    await getApplicationsPage({ cursor: badCursor });

    const orFn = (client._chain as { or: ReturnType<typeof vi.fn> }).or;
    const calls = orFn.mock.calls as string[][];
    const hasCursorFilter = calls.some(([f]) => f?.includes("applied_date.lt."));
    expect(hasCursorFilter).toBe(false);
  });

  it("ignores cursor when id portion is not a UUID", async () => {
    const client = makeClient();
    mockCreate.mockResolvedValue(client as never);

    // ID contains injection payload
    const malicious = btoa("2026-05-01|not-a-uuid,company.eq.ACME");
    await getApplicationsPage({ cursor: malicious });

    const orFn = (client._chain as { or: ReturnType<typeof vi.fn> }).or;
    const calls = orFn.mock.calls as string[][];
    const hasInjection = calls.some(([f]) => f?.includes("company.eq.ACME"));
    expect(hasInjection).toBe(false);
  });

  it("ignores a cursor that is not valid base64", async () => {
    const client = makeClient();
    mockCreate.mockResolvedValue(client as never);

    await getApplicationsPage({ cursor: "!!!not-base64!!!" });

    const orFn = (client._chain as { or: ReturnType<typeof vi.fn> }).or;
    const calls = orFn.mock.calls as string[][];
    const hasCursorFilter = calls.some(([f]) => f?.includes("applied_date.lt."));
    expect(hasCursorFilter).toBe(false);
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
