import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createChatSessionSchema } from "@/lib/validations/api";
import { ApiError, errorResponse, successResponse, HttpStatus } from "@/lib/api/errors";

// GET /api/nesta-ai/sessions - List all chat sessions for the user
export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw ApiError.unauthorized();
    }

    const { data: sessions, error } = await supabase
      .from("chat_sessions")
      .select(`
        id,
        title,
        created_at,
        updated_at
      `)
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Error fetching chat sessions:", error);
      throw ApiError.internal("Failed to fetch chat sessions");
    }

    return successResponse({ sessions: sessions || [] });
  } catch (error) {
    return errorResponse(error);
  }
}

// POST /api/nesta-ai/sessions - Create a new chat session
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw ApiError.unauthorized();
    }

    const body = await request.json().catch(() => ({}));
    const { title } = createChatSessionSchema.parse(body);

    const { data: session, error } = await supabase
      .from("chat_sessions")
      .insert({
        user_id: user.id,
        title,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating chat session:", error);
      throw ApiError.internal("Failed to create chat session");
    }

    return successResponse({ session }, HttpStatus.CREATED);
  } catch (error) {
    return errorResponse(error);
  }
}
