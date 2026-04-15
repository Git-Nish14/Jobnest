import { NextRequest, NextResponse } from "next/server";
import { lookup } from "node:dns/promises";
import { createClient } from "@/lib/supabase/server";
import { ApiError, errorResponse, validateBody } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyOrigin } from "@/lib/security/csrf";
import { z } from "zod";

// Extracts structured job data from a URL or pasted text using Groq.
// Returns: { company, position, location, salary_range, job_description }

const schema = z.object({
  url:  z.string().url().optional(),
  text: z.string().min(50, "Paste at least 50 characters of the job description.").max(20_000).optional(),
}).refine((d) => d.url || d.text, { message: "Provide either a URL or job description text." });

const EXTRACT_PROMPT = `Extract structured job posting data and respond ONLY with valid JSON in this exact format:
{
  "company": "<company name or null>",
  "position": "<job title or null>",
  "location": "<location or null>",
  "salary_range": "<salary range or null>",
  "job_description": "<full cleaned job description text>"
}
Do not include markdown. Use null for any field you cannot find. Keep job_description under 8000 characters.`;

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

// ── SSRF protection ────────────────────────────────────────────────────────
// Rejects URLs that resolve to private, loopback, or link-local IPs so a
// logged-in user cannot use this route to probe internal infrastructure
// (e.g. AWS metadata at 169.254.169.254, internal k8s services, etc.).

function isPrivateIp(ip: string): boolean {
  // IPv6 loopback / ULA / link-local
  if (ip === "::1") return true;
  if (/^(fc|fd)/i.test(ip)) return true;
  if (/^fe80/i.test(ip)) return true;
  // IPv4 private / loopback / link-local / CGNAT / reserved
  return [
    /^127\./,                               // loopback
    /^0\./,                                 // this-network
    /^10\./,                                // RFC-1918 class A
    /^172\.(1[6-9]|2\d|3[01])\./,          // RFC-1918 class B
    /^192\.168\./,                          // RFC-1918 class C
    /^169\.254\./,                          // link-local / AWS + GCP metadata
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // CGNAT (RFC-6598)
    /^192\.0\.[02]\./,                      // IETF protocol assignments
    /^198\.(1[89])\./,                      // benchmarking
    /^198\.51\.100\./,                      // TEST-NET-2
    /^203\.0\.113\./,                       // TEST-NET-3
    /^2[45]\d\./,                           // class D/E
  ].some((re) => re.test(ip));
}

const BLOCKED_HOSTNAMES = new Set(["localhost", "metadata.google.internal"]);

/** Throws a 422 fetchFailed response if the URL is unsafe to fetch. */
async function assertSafeUrl(rawUrl: string): Promise<void> {
  let parsed: URL;
  try { parsed = new URL(rawUrl); } catch { throw new SsrfError(); }
  if (!["http:", "https:"].includes(parsed.protocol)) throw new SsrfError();

  const hostname = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname)) throw new SsrfError();

  // Resolve all A/AAAA records and block any that are private.
  // DNS resolution failures are also rejected — an unresolvable host is not a valid job board.
  let addresses: { address: string }[];
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    throw new SsrfError();
  }
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateIp(address))) {
    throw new SsrfError();
  }
}

class SsrfError extends Error { readonly isSsrf = true; }

export async function POST(request: NextRequest) {
  try {
    if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin.");

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const rl = await checkRateLimit(`parse-jd:${user.id}`, { maxRequests: 10, windowMs: 60_000 });
    if (!rl.allowed) throw ApiError.tooManyRequests("Too many parse requests. Please wait a moment.");

    const { url, text } = await validateBody(request, schema);
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) throw ApiError.serviceUnavailable("AI service is not configured.");

    let jobText = text ?? "";

    // Try fetching the URL if provided
    if (url) {
      try {
        // SSRF guard: reject URLs that resolve to private/internal IPs.
        await assertSafeUrl(url);

        const res = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; Jobnest/1.0)" },
          signal: AbortSignal.timeout(10_000),
          redirect: "follow",
        });

        // Post-redirect SSRF check: reject if the final URL (after redirects)
        // resolves to a private address, e.g. public→private open-redirect attack.
        if (res.url && res.url !== url) {
          try { await assertSafeUrl(res.url); } catch { throw new SsrfError(); }
        }

        if (res.ok) {
          const html = await res.text();
          // Strip HTML tags and collapse whitespace
          jobText = html
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/&nbsp;/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/\s{2,}/g, " ")
            .trim()
            .slice(0, 12_000);
        }
      } catch {
        // URL fetch failed (network error, SSRF block, non-2xx) —
        // fall back to whatever text was provided.
        if (!jobText) {
          return NextResponse.json(
            { fetchFailed: true, error: "Couldn't fetch that URL automatically. Please paste the job description text instead." },
            { status: 422 }
          );
        }
      }
    }

    if (!jobText || jobText.length < 50) {
      return NextResponse.json(
        { error: "Not enough text to parse. Please paste the job description." },
        { status: 422 }
      );
    }

    const groqRes = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqKey}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: EXTRACT_PROMPT },
          { role: "user",   content: `JOB POSTING TEXT:\n${jobText}` },
        ],
        temperature:     0.1,
        max_tokens:      2000,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!groqRes.ok) {
      throw ApiError.serviceUnavailable("AI extraction failed. Please try again.");
    }

    const groqData = await groqRes.json() as { choices: { message: { content: string } }[] };
    const rawContent = groqData.choices?.[0]?.message?.content ?? "{}";

    let parsed: Record<string, string | null>;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      throw ApiError.internal("AI returned an invalid response. Please try again.");
    }

    return NextResponse.json({
      company:         parsed.company         ?? null,
      position:        parsed.position        ?? null,
      location:        parsed.location        ?? null,
      salary_range:    parsed.salary_range    ?? null,
      job_description: parsed.job_description ?? jobText.slice(0, 8_000),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
