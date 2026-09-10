import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyOrigin } from "@/lib/security/csrf";
import { z } from "zod";

const patchSchema = z.object({
  history: z.array(
    z.object({
      role:    z.enum(["user", "assistant"]),
      content: z.string().max(4000),
    })
  ).min(4).max(100),
});

/** GET — load the user's persisted NESTAi memory. */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const { data } = await supabase
      .from("nestai_memory")
      .select("preferences, updated_at")
      .eq("user_id", user.id)
      .maybeSingle();

    return NextResponse.json({
      preferences: data?.preferences ?? "",
      updatedAt:   data?.updated_at ?? null,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * PATCH — extract preferences from conversation history via Groq and persist them.
 * Called client-side after ≥ 4 exchanges in a session.
 */
export async function PATCH(request: NextRequest) {
  try {
    if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid origin.");

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const rl = await checkRateLimit(`nestai-memory:${user.id}`, {
      maxRequests: 10,
      windowMs: 60 * 60_000,
    });
    if (!rl.allowed) throw ApiError.tooManyRequests("Memory update rate limit reached.");

    const body = await request.json();
    const { history } = patchSchema.parse(body);

    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      return NextResponse.json({ skipped: "GROQ_API_KEY not configured" });
    }

    const extractionMessages = [
      {
        role: "system",
        content: `You extract concise, factual preference notes from a job-search chat history.
Output ONLY a bullet list (max 8 bullets, each ≤ 15 words). No preamble, no commentary.
Focus on: preferred roles/stacks, work style, target companies/sectors, communication preferences,
job-search goals. Skip anything already inferable from a standard resume.
If there is nothing useful to extract, output "NONE".`,
      },
      ...history.slice(-30),
      {
        role: "user",
        content: "Extract preference notes from this conversation.",
      },
    ];

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:  `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify({
        model:       "llama-3.1-8b-instant",
        messages:    extractionMessages,
        max_tokens:  256,
        temperature: 0.2,
      }),
    });

    if (!groqRes.ok) {
      console.error("[memory] Groq extraction error:", groqRes.status);
      return NextResponse.json({ skipped: "extraction failed" });
    }

    const groqJson = await groqRes.json();
    const extracted: string = groqJson.choices?.[0]?.message?.content?.trim() ?? "";

    if (!extracted || extracted === "NONE") {
      return NextResponse.json({ skipped: "nothing to persist" });
    }

    const { data: existing } = await supabase
      .from("nestai_memory")
      .select("preferences")
      .eq("user_id", user.id)
      .maybeSingle();

    const merged = existing?.preferences
      ? `${existing.preferences}\n${extracted}`
      : extracted;

    // Deduplicate and keep the NEWEST 20 unique bullets.
    // Using slice(-20) — not slice(0,20) — so recent preferences win when capped.
    const lines = Array.from(
      new Set(
        merged
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
      )
    ).slice(-20);

    const preferences = lines.join("\n");

    await supabase.from("nestai_memory").upsert(
      { user_id: user.id, preferences, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );

    return NextResponse.json({ ok: true, bullets: lines.length });
  } catch (err) {
    return errorResponse(err);
  }
}

/** DELETE — clear the user's NESTAi memory. */
export async function DELETE(request: NextRequest) {
  try {
    // CSRF guard — same-origin enforcement so a malicious cross-site page cannot
    // silently clear a user's memory via a credentialed DELETE request.
    if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid origin.");

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    await supabase.from("nestai_memory").delete().eq("user_id", user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
