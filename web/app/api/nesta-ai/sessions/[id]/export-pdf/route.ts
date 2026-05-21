import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { ChatPDFDocument } from "@/components/nestai/ChatPDFDocument";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    // Fetch session + messages — RLS ensures user only sees their own
    const { data: session, error: sessionError } = await supabase
      .from("nesta_ai_sessions")
      .select("id, title, created_at")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single();

    if (sessionError || !session) throw ApiError.notFound("Session not found.");

    const { data: messages, error: msgError } = await supabase
      .from("nesta_ai_messages")
      .select("role, content, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .limit(200);

    if (msgError) throw ApiError.internal("Failed to load messages.");

    const buffer = await renderToBuffer(
      createElement(ChatPDFDocument, {
        title: session.title,
        createdAt: session.created_at,
        messages: (messages ?? []).map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
          createdAt: m.created_at,
        })),
      })
    );

    const safeTitle = session.title.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="nestai-${safeTitle}.pdf"`,
        "Content-Length": String(buffer.byteLength),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
