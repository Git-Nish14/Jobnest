import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ApiError, errorResponse, validateBody } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { extractDocumentText } from "@/lib/utils/document-parser";
import { z } from "zod";

export const ATS_PROVIDERS = ["groq", "openai", "claude", "gemini", "perplexity"] as const;
export type ATSProvider = (typeof ATS_PROVIDERS)[number];

const scanSchema = z.object({
  document_id:     z.string().uuid("Invalid document_id"),
  job_description: z.string().min(50, "Job description must be at least 50 characters.").max(10_000),
  application_id:  z.string().uuid().optional(),
  provider:        z.enum(ATS_PROVIDERS).default("groq"),
});

// Server-side keyword overlap — anchors AI score to real data, prevents bias toward mid-range.
const STOPWORDS = new Set([
  "the","and","for","are","not","has","with","this","that","have","been","they",
  "you","your","will","from","into","about","which","their","more","also","when",
  "can","all","our","was","its","any","one","use","may","per","new","how","such",
  "each","both","other","than","then","only","very","well","over","must","some",
  "work","able","make","need","good","able","get","see","had","him","his","her",
]);

function extractKeywords(text: string): Set<string> {
  const raw = text.toLowerCase().match(/[a-z][a-z0-9+#._-]{2,}/g) ?? [];
  return new Set(raw.filter((w) => !STOPWORDS.has(w)));
}

interface OverlapStats {
  matched: number;
  total: number;
  pct: number; // 0-100, integer
}

function computeOverlap(resumeText: string, jdText: string): OverlapStats {
  const jdKw = extractKeywords(jdText);
  const resumeKw = extractKeywords(resumeText);
  const matched = [...jdKw].filter((w) => resumeKw.has(w)).length;
  const total = jdKw.size;
  const pct = total > 0 ? Math.round((matched / total) * 100) : 0;
  return { matched, total, pct };
}

const SYSTEM_PROMPT = `You are an expert ATS (Applicant Tracking System) scanner.

Your job is to analyse a resume against a job description and produce an accurate match assessment.

SCORING RULES — follow these exactly:
1. You will be given a pre-computed keyword overlap percentage from a statistical analysis.
2. Your "score" MUST start from that percentage as the baseline.
3. Adjust by AT MOST ±15 points based on contextual factors:
   - +points: matched keywords are role-critical (not generic); strong narrative alignment; correct seniority level
   - -points: missing keywords are core requirements; weak phrasing; wrong domain/seniority
4. Never output a score outside 0-100.
5. The score must accurately reflect how well THIS specific resume matches THIS specific job.

Respond ONLY with valid JSON in this exact format:
{
  "score": <integer 0-100>,
  "present_keywords": [<role-specific skills/tools/certs found in both texts — not generic words>],
  "missing_keywords": [<important role-specific JD terms absent from resume — ordered by importance>],
  "suggestions": [<3-5 concrete, actionable tips specific to the gaps above>],
  "summary": "<one precise sentence summarising the match quality and biggest gap>"
}`;

function buildUserMessage(resume: string, jd: string, overlap: OverlapStats) {
  return [
    `STATISTICAL KEYWORD OVERLAP: ${overlap.matched} of ${overlap.total} JD keywords found in resume (${overlap.pct}%).`,
    `Use ${overlap.pct}% as your score baseline. Adjust ±15 max based on keyword importance and context.`,
    "",
    "RESUME:",
    resume.slice(0, 4_000),
    "",
    "---",
    "",
    "JOB DESCRIPTION:",
    jd.slice(0, 4_000),
  ].join("\n");
}

interface AIMessage { role: "system" | "user" | "assistant"; content: string; }

async function callOpenAICompat({
  apiKey,
  baseUrl,
  model,
  messages,
  jsonMode,
}: {
  apiKey: string;
  baseUrl: string;
  model: string;
  messages: AIMessage[];
  jsonMode: boolean;
}): Promise<string> {
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: 0.3,
    max_tokens:  1000,
  };
  if (jsonMode) body.response_format = { type: "json_object" };

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const data = await res.json() as { choices: { message: { content: string } }[] };
  return data.choices?.[0]?.message?.content ?? "{}";
}

async function callGemini(apiKey: string, userMessage: string): Promise<string> {
  const model = "gemini-1.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        { role: "user", parts: [{ text: `${SYSTEM_PROMPT}\n\n${userMessage}` }] },
      ],
      generationConfig: {
        temperature:     0.1,
        maxOutputTokens: 1000,
        responseMimeType: "application/json",
      },
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = await res.json() as {
    candidates: { content: { parts: { text: string }[] } }[];
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
}

async function callClaude(apiKey: string, userMessage: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key":    apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model:      "claude-haiku-4-5",
      max_tokens: 1024,
      system:     SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) throw new Error(`Claude ${res.status}: ${await res.text()}`);
  const data = await res.json() as {
    content: { type: string; text: string }[];
  };
  return data.content?.find((b) => b.type === "text")?.text ?? "{}";
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const rl = await checkRateLimit(`ats-scan:${user.id}`, { maxRequests: 10, windowMs: 60_000 });
    if (!rl.allowed) {
      throw ApiError.tooManyRequests("ATS scan rate limit reached. Please wait a minute before scanning again.");
    }

    const body = await validateBody(request, scanSchema);
    const provider = body.provider;

    const { data: doc, error: fetchErr } = await supabase
      .from("application_documents")
      .select("storage_path, mime_type, label, original_name")
      .eq("id", body.document_id)
      .eq("user_id", user.id)
      .single();

    if (fetchErr || !doc) throw ApiError.notFound("Document not found.");

    const { text, error: parseError } = await extractDocumentText(supabase, doc.storage_path);
    if (parseError || !text) {
      throw ApiError.badRequest(
        parseError ?? "Could not extract text from this document. Only PDF, DOCX, DOC, TXT, and MD files are supported for ATS scanning."
      );
    }

    const overlap = computeOverlap(text, body.job_description);
    const userMessage = buildUserMessage(text, body.job_description, overlap);

    let rawContent: string;

    try {
      switch (provider) {
        case "groq": {
          const apiKey = process.env.GROQ_API_KEY;
          if (!apiKey) throw new Error("GROQ_API_KEY not configured");
          rawContent = await callOpenAICompat({
            apiKey,
            baseUrl:  "https://api.groq.com/openai/v1",
            model:    "llama-3.3-70b-versatile",
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user",   content: userMessage },
            ],
            jsonMode: true,
          });
          break;
        }
        case "openai": {
          const apiKey = process.env.OPENAI_API_KEY;
          if (!apiKey) throw new Error("OPENAI_API_KEY not configured");
          rawContent = await callOpenAICompat({
            apiKey,
            baseUrl:  "https://api.openai.com/v1",
            model:    "gpt-4o-mini",
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user",   content: userMessage },
            ],
            jsonMode: true,
          });
          break;
        }
        case "claude": {
          const apiKey = process.env.ANTHROPIC_API_KEY;
          if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");
          rawContent = await callClaude(apiKey, userMessage);
          break;
        }
        case "gemini": {
          const apiKey = process.env.GEMINI_API_KEY;
          if (!apiKey) throw new Error("GEMINI_API_KEY not configured");
          rawContent = await callGemini(apiKey, userMessage);
          break;
        }
        case "perplexity": {
          const apiKey = process.env.PERPLEXITY_API_KEY;
          if (!apiKey) throw new Error("PERPLEXITY_API_KEY not configured");
          rawContent = await callOpenAICompat({
            apiKey,
            baseUrl:  "https://api.perplexity.ai",
            model:    "llama-3.1-sonar-small-128k-online",
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user",   content: userMessage },
            ],
            jsonMode: false,
          });
          break;
        }
        default:
          throw new Error(`Unknown provider: ${provider}`);
      }
    } catch (providerErr) {
      const msg = providerErr instanceof Error ? providerErr.message : String(providerErr);
      console.error(`[ats-scan] ${provider} error:`, msg);
      throw ApiError.serviceUnavailable(
        msg.includes("not configured")
          ? `${provider} is not configured on this server.`
          : `AI analysis failed (${provider}). Please try again or switch to a different provider.`
      );
    }

    const clean = rawContent.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

    let result: Record<string, unknown>;
    try {
      result = JSON.parse(clean);
    } catch {
      throw ApiError.internal("AI returned an invalid response. Please try again or switch provider.");
    }

    const score = typeof result.score === "number" ? result.score : null;
    if (score !== null && body.application_id) {
      supabase
        .from("job_applications")
        .update({ ats_score: score })
        .eq("id", body.application_id)
        .eq("user_id", user.id)
        .then(({ error }) => {
          if (error) console.error("ats-scan: failed to persist score", error.message);
        });
    }

    return NextResponse.json({
      document: { id: body.document_id, label: doc.label, name: doc.original_name },
      ats:      result,
      provider,
      overlap,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET() {
  const configured: ATSProvider[] = [];
  if (process.env.GROQ_API_KEY)       configured.push("groq");
  if (process.env.OPENAI_API_KEY)     configured.push("openai");
  if (process.env.ANTHROPIC_API_KEY)  configured.push("claude");
  if (process.env.GEMINI_API_KEY)     configured.push("gemini");
  if (process.env.PERPLEXITY_API_KEY) configured.push("perplexity");
  return NextResponse.json({ configured });
}
