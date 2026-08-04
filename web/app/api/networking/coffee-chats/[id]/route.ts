import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyOrigin } from "@/lib/security/csrf";
import { ApiError, errorResponse, successResponse } from "@/lib/api/errors";
import { z } from "zod";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const patchSchema = z.object({
  contact_id:       z.string().uuid().optional().nullable(),
  scheduled_at:     z.string().datetime().optional(),
  medium:           z.enum(["Zoom", "Phone", "In-person", "Google Meet", "Teams"]).optional(),
  status:           z.enum(["Scheduled", "Completed", "Cancelled", "No-show"]).optional(),
  agenda:           z.string().max(2000).optional().nullable(),
  notes:            z.string().max(5000).optional().nullable(),
  follow_up_sent:   z.boolean().optional(),
  referral_outcome: z.string().max(500).optional().nullable(),
});

interface Params { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin.");

    const { id } = await params;
    if (!UUID_RE.test(id)) throw ApiError.badRequest("Invalid coffee chat ID.");

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const rl = await checkRateLimit(`networking:chats:patch:${user.id}`, { maxRequests: 30, windowMs: 60_000 });
    if (!rl.allowed) throw ApiError.tooManyRequests("Too many requests.");

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid input";
      throw ApiError.badRequest(msg);
    }

    const { data, error } = await supabase
      .from("coffee_chats")
      .update(parsed.data)
      .eq("id", id)
      .eq("user_id", user.id)
      .select("*, contact:contacts(name, title, company)")
      .single();

    if (error || !data) throw ApiError.notFound("Coffee chat not found.");

    return successResponse({ chat: data });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin.");

    const { id } = await params;
    if (!UUID_RE.test(id)) throw ApiError.badRequest("Invalid coffee chat ID.");

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const rl = await checkRateLimit(`networking:chats:delete:${user.id}`, { maxRequests: 30, windowMs: 60_000 });
    if (!rl.allowed) throw ApiError.tooManyRequests("Too many requests.");

    const { error } = await supabase
      .from("coffee_chats")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw ApiError.internal("Failed to delete coffee chat.");

    return successResponse({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
