import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createChatMessageSchema } from "@/lib/validations/api";
import { ApiError, errorResponse, validateBody, successResponse, HttpStatus } from "@/lib/api/errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/nesta-ai/sessions/[id]/messages - Add a message to a chat session
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: sessionId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw ApiError.unauthorized();
    }

    // Verify session exists and belongs to user
    const { data: session, error: sessionError } = await supabase
      .from("chat_sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single();

    if (sessionError || !session) {
      throw ApiError.notFound("Chat session not found");
    }

    const { role, content } = await validateBody(request, createChatMessageSchema);

    const { data: message, error } = await supabase
      .from("chat_messages")
      .insert({
        session_id: sessionId,
        user_id: user.id,
        role,
        content,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating message:", error);
      throw ApiError.internal("Failed to save message");
    }

    // Update session's updated_at timestamp
    await supabase
      .from("chat_sessions")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", sessionId);

    return successResponse({ message }, HttpStatus.CREATED);
  } catch (error) {
    return errorResponse(error);
  }
}
