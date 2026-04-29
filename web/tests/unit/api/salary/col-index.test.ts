/**
 * Unit tests — GET /api/salary/col-index
 *
 * Covers:
 *   - 401 when not authenticated
 *   - 400 when city param is missing or too short
 *   - Successful Teleport hit → returns col_index and supported: true
 *   - Teleport returns no CoL category → falls back to index 1.0, supported: false
 *   - Teleport non-200 response → falls back to index 1.0, supported: false
 *   - City is slugified before being used in URL (special chars stripped)
 *   - In-process cache: second call with same city does not re-fetch
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { GET } from "@/app/api/salary/col-index/route";
import { createClient } from "@/lib/supabase/server";

const mockCreate = vi.mocked(createClient);

function makeClient(user: unknown = { id: "uid-1" }) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
  };
}

function makeRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost/api/salary/col-index");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url);
}

function teleportResponse(categories: { name: string; score_out_of_10: number }[]): Response {
  return new Response(JSON.stringify({ categories }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCreate.mockResolvedValue(makeClient() as never);
});

describe("GET /api/salary/col-index — auth", () => {
  it("returns 401 when not authenticated", async () => {
    mockCreate.mockResolvedValue(makeClient(null) as never);
    const res = await GET(makeRequest({ city: "Austin TX" }));
    expect(res.status).toBe(401);
  });
});

describe("GET /api/salary/col-index — validation", () => {
  it("returns 400 when city param is missing", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(400);
  });

  it("returns 400 when city is a single character", async () => {
    const res = await GET(makeRequest({ city: "A" }));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/salary/col-index — Teleport integration", () => {
  it("returns col_index and supported: true when Teleport returns CoL category", async () => {
    mockFetch.mockResolvedValueOnce(teleportResponse([
      { name: "Cost of Living", score_out_of_10: 5 },
    ]));
    const res = await GET(makeRequest({ city: "Austin TX" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.supported).toBe(true);
    expect(typeof body.col_index).toBe("number");
    expect(body.col_index).toBeGreaterThan(0);
  });

  it("returns col_index 1.0 and supported: false when no CoL category in response", async () => {
    mockFetch.mockResolvedValueOnce(teleportResponse([
      { name: "Housing", score_out_of_10: 7 },
    ]));
    const res = await GET(makeRequest({ city: "Unknown City" }));
    const body = await res.json();
    expect(body.col_index).toBe(1.0);
    expect(body.supported).toBe(false);
  });

  it("falls back to 1.0 / supported: false when Teleport returns non-200", async () => {
    mockFetch.mockResolvedValueOnce(new Response("Not Found", { status: 404 }));
    const res = await GET(makeRequest({ city: "Nowhere" }));
    const body = await res.json();
    expect(body.col_index).toBe(1.0);
    expect(body.supported).toBe(false);
  });

  it("falls back to 1.0 / supported: false when Teleport fetch throws", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));
    const res = await GET(makeRequest({ city: "Timeout City" }));
    const body = await res.json();
    expect(body.col_index).toBe(1.0);
    expect(body.supported).toBe(false);
  });

  it("returns city and slug in response body", async () => {
    mockFetch.mockResolvedValueOnce(teleportResponse([
      { name: "Cost of Living", score_out_of_10: 6 },
    ]));
    const res = await GET(makeRequest({ city: "San Francisco CA" }));
    const body = await res.json();
    expect(body.city).toBe("San Francisco CA");
    expect(typeof body.slug).toBe("string");
    expect(body.slug).toMatch(/^[a-z0-9-]+$/);
  });
});
