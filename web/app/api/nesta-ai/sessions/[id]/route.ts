import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateChatSessionSchema } from "@/lib/validations/api";
import { ApiError, errorResponse, validateBody, successResponse } from "@/lib/api/errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/nesta-ai/sessions/[id] - Get a specific chat session with messages
export async function GET(_: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw ApiError.unauthorized();
    }

    // Get session
    const { data: session, error: sessionError } = await supabase
      .from("chat_sessions")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (sessionError || !session) {
      throw ApiError.notFound("Chat session not found");
    }

    // Get messages
    const { data: messages, error: messagesError } = await supabase
      .from("chat_messages")
      .select("id, role, content, metadata, created_at")
      .eq("session_id", id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (messagesError) {
      console.error("Error fetching messages:", messagesError);
      throw ApiError.internal("Failed to fetch messages");
    }

    return successResponse({
      session: {
        ...session,
        messages: messages || [],
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

// PATCH /api/nesta-ai/sessions/[id] - Update chat session title
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw ApiError.unauthorized();
    }

    const body = await validateBody(request, updateChatSessionSchema);
    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.is_pinned !== undefined) updateData.is_pinned = body.is_pinned;

    const { data: session, error } = await supabase
      .from("chat_sessions")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error || !session) {
      throw ApiError.notFound("Chat session not found");
    }

    return successResponse({ session });
  } catch (error) {
    return errorResponse(error);
  }
}

// DELETE /api/nesta-ai/sessions/[id] - Delete a chat session
export async function DELETE(_: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw ApiError.unauthorized();
    }

    const { error } = await supabase
      .from("chat_sessions")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting chat session:", error);
      throw ApiError.internal("Failed to delete chat session");
    }

    return successResponse({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
