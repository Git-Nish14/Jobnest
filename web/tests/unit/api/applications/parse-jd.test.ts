/**
 * Unit tests — POST /api/applications/parse-jd
 *
 * Covers:
 *   - Auth, origin check, rate limiting, input validation
 *   - Text mode: success, Groq failure, invalid JSON from AI
 *   - URL mode: success (DNS resolves to public IP + fetch OK)
 *   - SSRF protection: private/loopback/link-local IPs blocked
 *   - URL fetch failure → fetchFailed flag
 *   - URL + text fallback when URL fetch fails
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup: vi.fn() }));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { POST } from "@/app/api/applications/parse-jd/route";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { lookup } from "node:dns/promises";

const mockRL     = vi.mocked(checkRateLimit);
const mockCreate = vi.mocked(createClient);
const mockLookup = vi.mocked(lookup);

const PUBLIC_ADDRESSES  = [{ address: "93.184.216.34", family: 4 }]; // example.com

function makeClient(user: unknown = { id: "uid-123" }) {
  return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) } };
}

/** JSON POST request — no Origin header → verifyOrigin returns true (same-origin pass-through) */
function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/applications/parse-jd", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Request with a foreign Origin → verifyOrigin returns false → 403 */
function crossOriginRequest(body: unknown): Request {
  return new Request("http://localhost/api/applications/parse-jd", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://evil.example.com" },
    body: JSON.stringify(body),
  });
}

const GROQ_FIELDS = {
  company: "Acme Corp",
  position: "Software Engineer",
  location: "Remote",
  salary_range: "$120k–$150k",
  job_description: "Build great products end to end.",
};

function groqResponse(content: string = JSON.stringify(GROQ_FIELDS)): Response {
  return new Response(
    JSON.stringify({ choices: [{ message: { content } }] }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

function htmlFetchResponse(html: string, finalUrl = "https://example.com/job"): Response {
  return {
    ok: true,
    url: finalUrl,
    text: vi.fn().mockResolvedValue(html),
  } as unknown as Response;
}

const LONG_TEXT = "Senior Software Engineer at Acme Corp – Remote. Build scalable systems. " + "x".repeat(60);

beforeEach(() => {
  // resetAllMocks clears the "once" queue in addition to call history so residual
  // unconsumed mockResolvedValueOnce values cannot bleed into the next test.
  vi.resetAllMocks();
  mockRL.mockReturnValue({ allowed: true, remaining: 9, resetTime: Date.now() + 60_000 });
  mockCreate.mockResolvedValue(makeClient() as never);
  // Default: DNS resolves to a public IP
  mockLookup.mockResolvedValue(PUBLIC_ADDRESSES as never);
  // Default: Groq returns structured fields
  mockFetch.mockResolvedValue(groqResponse());
});

// ── Auth & gate checks ────────────────────────────────────────────────────────

describe("POST /api/applications/parse-jd — auth & gates", () => {
  it("returns 403 when origin is cross-site", async () => {
    const res = await POST(crossOriginRequest({ text: LONG_TEXT }) as never);
    expect(res.status).toBe(403);
  });

  it("returns 401 when not authenticated", async () => {
    mockCreate.mockResolvedValue(makeClient(null) as never);
    const res = await POST(jsonRequest({ text: LONG_TEXT }) as never);
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockRL.mockReturnValue({ allowed: false, remaining: 0, resetTime: Date.now() + 60_000 });
    const res = await POST(jsonRequest({ text: LONG_TEXT }) as never);
    expect(res.status).toBe(429);
  });
});

// ── Input validation ──────────────────────────────────────────────────────────

describe("POST /api/applications/parse-jd — input validation", () => {
  it("returns 422 when neither url nor text is provided", async () => {
    const res = await POST(jsonRequest({}) as never);
    expect(res.status).toBe(422);
  });

  it("returns 422 when text is shorter than 50 characters", async () => {
    const res = await POST(jsonRequest({ text: "too short" }) as never);
    expect(res.status).toBe(422);
  });

  it("returns 422 when url is not a valid URL string", async () => {
    const res = await POST(jsonRequest({ url: "not-a-url" }) as never);
    expect(res.status).toBe(422);
  });
});

// ── Text mode ─────────────────────────────────────────────────────────────────

describe("POST /api/applications/parse-jd — text mode", () => {
  it("returns 200 with all extracted fields on success", async () => {
    const res = await POST(jsonRequest({ text: LONG_TEXT }) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.company).toBe("Acme Corp");
    expect(body.position).toBe("Software Engineer");
    expect(body.location).toBe("Remote");
    expect(body.salary_range).toBe("$120k–$150k");
    expect(body.job_description).toBeDefined();
  });

  it("returns null for fields the AI marks as null", async () => {
    const sparse = JSON.stringify({
      company: null, position: "Engineer", location: null,
      salary_range: null, job_description: "Great role.",
    });
    mockFetch.mockResolvedValueOnce(groqResponse(sparse));
    const res = await POST(jsonRequest({ text: LONG_TEXT }) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.company).toBeNull();
    expect(body.location).toBeNull();
    expect(body.position).toBe("Engineer");
  });

  it("returns 503 when Groq API responds with an error status", async () => {
    mockFetch.mockResolvedValueOnce(new Response("{}", { status: 500 }));
    const res = await POST(jsonRequest({ text: LONG_TEXT }) as never);
    expect(res.status).toBe(503);
  });

  it("returns 500 when Groq returns content that is not valid JSON", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ choices: [{ message: { content: "here are the fields: not json" } }] }),
        { status: 200 }
      )
    );
    const res = await POST(jsonRequest({ text: LONG_TEXT }) as never);
    expect(res.status).toBe(500);
  });

  it("falls back to sliced jobText when AI omits job_description", async () => {
    const noJd = JSON.stringify({ company: "Acme", position: "Eng", location: null, salary_range: null, job_description: null });
    mockFetch.mockResolvedValueOnce(groqResponse(noJd));
    const res = await POST(jsonRequest({ text: LONG_TEXT }) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    // Should fall back to sliced jobText, not null
    expect(body.job_description).toBeTruthy();
  });
});

// ── URL mode — happy path ─────────────────────────────────────────────────────

describe("POST /api/applications/parse-jd — URL mode", () => {
  it("returns 200 with extracted fields when URL fetch and Groq both succeed", async () => {
    const html = "<html><body>Senior Engineer at Acme Corp – Remote work " + "y".repeat(100) + "</body></html>";
    mockFetch
      .mockResolvedValueOnce(htmlFetchResponse(html))  // URL fetch
      .mockResolvedValueOnce(groqResponse());           // Groq

    const res = await POST(jsonRequest({ url: "https://example.com/job" }) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.company).toBe("Acme Corp");
    // DNS was called for the initial URL
    expect(mockLookup).toHaveBeenCalledWith("example.com", { all: true });
  });

  it("strips HTML tags before passing text to Groq", async () => {
    // Must have >50 chars of visible text after stripping so the route reaches the Groq call.
    const visibleText = "Senior Software Engineer position at WidgetCo – fully remote, competitive salary. " + "x".repeat(60);
    const html = `<html><head><style>body{color:red}</style></head>
      <body><script>alert(1)</script><p>${visibleText}</p></body></html>`;
    mockFetch
      .mockResolvedValueOnce(htmlFetchResponse(html))
      .mockResolvedValueOnce(groqResponse());

    await POST(jsonRequest({ url: "https://example.com/job" }) as never);

    // Groq was called with stripped text (no <script>, no <style>)
    const groqCall = mockFetch.mock.calls.find(
      (c) => typeof c[0] === "string" && (c[0] as string).includes("groq.com")
    );
    expect(groqCall).toBeDefined();
    const reqBody = JSON.parse((groqCall![1] as RequestInit).body as string);
    const userContent: string = (reqBody.messages as { role: string; content: string }[])
      .find((m) => m.role === "user")!.content;
    expect(userContent).not.toContain("<script>");
    expect(userContent).not.toContain("<style>");
    expect(userContent).toContain("WidgetCo");
  });

  it("returns fetchFailed when URL fetch throws a network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network failure"));
    const res = await POST(jsonRequest({ url: "https://example.com/job" }) as never);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.fetchFailed).toBe(true);
  });

  it("proceeds with text fallback when URL fails but text is also provided", async () => {
    mockLookup.mockRejectedValueOnce(new Error("DNS NXDOMAIN")); // URL DNS fails
    mockFetch.mockResolvedValueOnce(groqResponse()); // Only Groq is called
    const res = await POST(jsonRequest({ url: "https://example.com/job", text: LONG_TEXT }) as never);
    expect(res.status).toBe(200);
  });
});

// ── SSRF protection ───────────────────────────────────────────────────────────

describe("POST /api/applications/parse-jd — SSRF protection", () => {
  it("blocks loopback IP 127.0.0.1 and returns fetchFailed", async () => {
    mockLookup.mockResolvedValueOnce([{ address: "127.0.0.1", family: 4 }] as never);
    const res = await POST(jsonRequest({ url: "https://jobs.example.com/posting" }) as never);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.fetchFailed).toBe(true);
    // fetch should NOT have been called for the URL
    const urlFetchCall = mockFetch.mock.calls.find(
      (c) => typeof c[0] === "string" && (c[0] as string).includes("jobs.example.com")
    );
    expect(urlFetchCall).toBeUndefined();
  });

  it("blocks AWS/GCP metadata IP 169.254.169.254 and returns fetchFailed", async () => {
    mockLookup.mockResolvedValueOnce([{ address: "169.254.169.254", family: 4 }] as never);
    const res = await POST(jsonRequest({ url: "https://jobs.example.com/posting" }) as never);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.fetchFailed).toBe(true);
  });

  it("blocks RFC-1918 address 10.0.0.1 and returns fetchFailed", async () => {
    mockLookup.mockResolvedValueOnce([{ address: "10.0.0.1", family: 4 }] as never);
    const res = await POST(jsonRequest({ url: "https://jobs.example.com/posting" }) as never);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.fetchFailed).toBe(true);
  });

  it("blocks RFC-1918 address 192.168.1.100 and returns fetchFailed", async () => {
    mockLookup.mockResolvedValueOnce([{ address: "192.168.1.100", family: 4 }] as never);
    const res = await POST(jsonRequest({ url: "https://jobs.example.com/posting" }) as never);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.fetchFailed).toBe(true);
  });

  it("blocks hostname 'localhost' without even calling DNS", async () => {
    const res = await POST(jsonRequest({ url: "http://localhost/admin" }) as never);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.fetchFailed).toBe(true);
    // DNS lookup should not be called for the blocked hostname
    expect(mockLookup).not.toHaveBeenCalledWith("localhost", expect.anything());
  });

  it("blocks 'metadata.google.internal' without calling DNS", async () => {
    const res = await POST(jsonRequest({ url: "http://metadata.google.internal/computeMetadata/v1/" }) as never);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.fetchFailed).toBe(true);
    expect(mockLookup).not.toHaveBeenCalledWith("metadata.google.internal", expect.anything());
  });

  it("blocks when DNS resolution fails entirely (unresolvable host)", async () => {
    mockLookup.mockRejectedValueOnce(new Error("ENOTFOUND bogus.invalid"));
    const res = await POST(jsonRequest({ url: "https://bogus.invalid/job" }) as never);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.fetchFailed).toBe(true);
  });

  it("blocks post-redirect target when it resolves to a private IP", async () => {
    // Pre-redirect DNS: public IP (example.com → 1.2.3.4)
    // Post-redirect DNS: private IP (internal.corp → 10.0.0.1)
    mockLookup
      .mockResolvedValueOnce([{ address: "93.184.216.34", family: 4 }] as never) // initial URL check
      .mockResolvedValueOnce([{ address: "10.0.0.1", family: 4 }] as never);     // redirect target check

    // Fetch returns a redirect response to an "internal" URL
    mockFetch.mockResolvedValueOnce({
      ok: true,
      url: "https://internal.corp/secret",   // simulated redirect target
      text: vi.fn().mockResolvedValue("<p>secret data</p>"),
    } as unknown as Response);

    const res = await POST(jsonRequest({ url: "https://example.com/redirect" }) as never);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.fetchFailed).toBe(true);
  });
});
