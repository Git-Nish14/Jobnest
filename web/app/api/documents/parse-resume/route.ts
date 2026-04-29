import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ApiError, errorResponse, successResponse, validateBody } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyOrigin } from "@/lib/security/csrf";
import { extractDocumentText } from "@/lib/utils/document-parser";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

const SYSTEM_PROMPT = `You are a resume parser. Extract structured data from the resume text provided.
Return a JSON object with exactly these fields (use null for fields you cannot find):
{
  "name": string | null,
  "email": string | null,
  "skills": [{ "name": string, "category": "Language"|"Framework"|"Database"|"Cloud"|"Tool"|"Soft", "proficiency": "Beginner"|"Intermediate"|"Advanced"|"Expert" }],
  "education": [{ "institution": string, "degree": "BS"|"MS"|"PhD"|"MBA"|"Associate"|"Bootcamp"|"Certificate"|"Self-taught"|"Other", "field_of_study": string|null, "start_date": "YYYY-MM-DD"|null, "end_date": "YYYY-MM-DD"|null, "is_current": boolean, "gpa": number|null }],
  "certifications": [{ "name": string, "provider": string|null, "issued_at": "YYYY-MM-DD"|null, "expires_at": "YYYY-MM-DD"|null }],
  "experience": [{ "company": string, "title": string, "start_date": "YYYY-MM-DD"|null, "end_date": "YYYY-MM-DD"|null, "is_current": boolean }]
}
Return only the JSON object, no markdown fences, no explanation.`;

const schema = z.object({
  document_id: z.string().uuid("Invalid document ID"),
});

export async function POST(request: NextRequest) {
  try {
    if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin.");

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const rl = await checkRateLimit(`parse-resume:${user.id}`, { maxRequests: 5, windowMs: 60_000 });
    if (!rl.allowed) throw ApiError.tooManyRequests("Too many parse requests. Please wait a moment.");

    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) throw ApiError.serviceUnavailable("AI service is not configured.");

    const { document_id } = await validateBody(request, schema);

    // Verify document belongs to this user
    const { data: doc, error: docError } = await supabase
      .from("application_documents")
      .select("storage_path, mime_type, original_name, label")
      .eq("id", document_id)
      .eq("user_id", user.id)
      .single();

    if (docError || !doc) throw ApiError.notFound("Document not found.");

    // Extract text from the document
    const { text, error: parseError } = await extractDocumentText(supabase, doc.storage_path);
    if (parseError || !text) {
      throw ApiError.badRequest(
        parseError || "Could not extract text from this document. Make sure it's a readable PDF, DOCX, or text file."
      );
    }

    // Truncate to 5000 chars for the AI call
    const resumeText = text.slice(0, 5000);

    const groqRes = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqKey}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.1,
        max_tokens: 3000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user",   content: `Resume text:\n\n${resumeText}` },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text().catch(() => "");
      console.error("[parse-resume] Groq error:", groqRes.status, errText);
      throw ApiError.serviceUnavailable("AI service is temporarily unavailable. Please try again.");
    }

    const groqData = await groqRes.json();
    const rawContent: string = groqData.choices?.[0]?.message?.content ?? "{}";

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawContent.replace(/```json\n?|```\n?/g, "").trim());
    } catch {
      throw ApiError.internal("AI returned an unexpected format. Please try again.");
    }

    // Normalise + count what was extracted
    const skills         = Array.isArray(parsed.skills)         ? parsed.skills         : [];
    const education      = Array.isArray(parsed.education)      ? parsed.education      : [];
    const certifications = Array.isArray(parsed.certifications) ? parsed.certifications : [];
    const experience     = Array.isArray(parsed.experience)     ? parsed.experience     : [];

    return successResponse({
      document: {
        id: document_id,
        label: doc.label,
        name: doc.original_name,
      },
      extracted: {
        name:    parsed.name ?? null,
        email:   parsed.email ?? null,
        skills,
        education,
        certifications,
        experience,
      },
      counts: {
        skills:         skills.length,
        education:      education.length,
        certifications: certifications.length,
        experience:     experience.length,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
