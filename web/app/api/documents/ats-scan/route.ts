import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ApiError, errorResponse, validateBody } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { extractDocumentText } from "@/lib/utils/document-parser";
import { z } from "zod";

const scanSchema = z.object({
  document_id:    z.string().uuid("Invalid document_id"),
  job_description: z.string().min(50, "Job description must be at least 50 characters.").max(10_000),
});

const GROQ_MODEL   = "llama-3.3-70b-versatile";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

/**
 * POST /api/documents/ats-scan
 * Extracts text from a resume document, compares it against the provided job description,
 * and returns an ATS match score + list of missing / present keywords via NESTAi (Groq).
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const rl = await checkRateLimit(`ats-scan:${user.id}`, { maxRequests: 5, windowMs: 60_000 });
    if (!rl.allowed) {
      throw ApiError.tooManyRequests("ATS scan rate limit reached. Please wait a minute before scanning again.");
    }

    const body = await validateBody(request, scanSchema);

    // Fetch the document — RLS ensures ownership
    const { data: doc, error: fetchErr } = await supabase
      .from("application_documents")
      .select("storage_path, mime_type, label, original_name")
      .eq("id", body.document_id)
      .eq("user_id", user.id)
      .single();

    if (fetchErr || !doc) throw ApiError.notFound("Document not found.");

    // Extract text from the resume
    const { text, error: parseError } = await extractDocumentText(supabase, doc.storage_path);
    if (parseError || !text) {
      throw ApiError.badRequest(
        parseError ?? "Could not extract text from this document. Only PDF, DOCX, DOC, TXT, and MD files are supported for ATS scanning."
      );
    }

    const systemPrompt = `You are an expert ATS (Applicant Tracking System) scanner.
Analyse a resume against a job description and respond ONLY with valid JSON in this exact format:
{
  "score": <integer 0-100>,
  "present_keywords": [<array of strings found in both resume and JD>],
  "missing_keywords": [<array of important JD keywords NOT found in resume>],
  "suggestions": [<array of 3-5 short actionable improvement tips>],
  "summary": "<one sentence overall assessment>"
}
Be precise. Keywords should be specific skills, tools, certifications, or role-specific terms — not generic words.`;

    const userMessage = `RESUME:\n${text.slice(0, 4000)}\n\n---\n\nJOB DESCRIPTION:\n${body.job_description.slice(0, 4000)}`;

    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) throw ApiError.serviceUnavailable("AI service is not configured.");

    const groqRes = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userMessage },
        ],
        temperature: 0.1,
        max_tokens:  1000,
        response_format: { type: "json_object" },
      }),
    });

    if (!groqRes.ok) {
      const err = await groqRes.text();
      console.error("Groq ATS scan error:", err);
      throw ApiError.serviceUnavailable("AI analysis failed. Please try again.");
    }

    const groqData = await groqRes.json() as {
      choices: { message: { content: string } }[];
    };

    const rawContent = groqData.choices?.[0]?.message?.content ?? "{}";

    let result: Record<string, unknown>;
    try {
      result = JSON.parse(rawContent);
    } catch {
      throw ApiError.internal("AI returned an invalid response. Please try again.");
    }

    return NextResponse.json({
      document: { id: body.document_id, label: doc.label, name: doc.original_name },
      ats: result,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
