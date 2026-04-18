import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyOrigin } from "@/lib/security/csrf";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

// NOTE: response_format:json_object forces the model to return a JSON *object*,
// so the prompt must request an object shape — never a bare array.
const SYSTEM_PROMPT = `You are a resume tailoring expert. Given a job description, extract 6–8 specific, actionable resume tailoring recommendations.

Each item must be a concrete action: what to add, emphasise, reword, or quantify in a resume to better match this role.

Return ONLY a valid JSON object in this exact format, with no markdown or explanation:
{"items": ["recommendation 1", "recommendation 2", ...]}`;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin.");

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const rl = await checkRateLimit(`tailoring:${user.id}`, { maxRequests: 10, windowMs: 60_000 });
    if (!rl.allowed) throw ApiError.tooManyRequests("Too many requests. Please wait a moment.");

    const { id } = await params;

    const { data: app, error: fetchError } = await supabase
      .from("job_applications")
      .select("job_description, company, position")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !app) throw ApiError.notFound("Application not found.");

    if (!app.job_description || app.job_description.trim().length < 50) {
      return NextResponse.json(
        { error: "Add a job description (at least 50 characters) to generate tailoring tips." },
        { status: 422 }
      );
    }

    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) throw ApiError.serviceUnavailable("AI service is not configured.");

    const groqRes = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqKey}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Role: ${app.position} at ${app.company}\n\nJob description:\n${app.job_description.slice(0, 8_000)}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 800,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!groqRes.ok) throw ApiError.serviceUnavailable("AI service failed. Please try again.");

    const groqData = await groqRes.json() as { choices: { message: { content: string } }[] };
    const raw = groqData.choices?.[0]?.message?.content ?? "[]";

    let items: string[];
    try {
      const parsed = JSON.parse(raw) as { items?: unknown };
      // json_object mode always returns an object — key is "items" per the prompt.
      // Defensively accept a plain array too in case the model deviates.
      const candidate = Array.isArray(parsed)
        ? parsed
        : Array.isArray((parsed as Record<string, unknown>).items)
          ? (parsed as { items: unknown[] }).items
          : [];
      items = (candidate as unknown[])
        .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        .slice(0, 8);
    } catch {
      throw ApiError.internal("AI returned an unexpected response. Please try again.");
    }

    if (items.length === 0) throw ApiError.internal("Could not generate checklist. Please try again.");

    return NextResponse.json({ items });
  } catch (error) {
    return errorResponse(error);
  }
}
