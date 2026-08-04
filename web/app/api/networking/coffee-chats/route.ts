import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyOrigin } from "@/lib/security/csrf";
import { ApiError, errorResponse, successResponse } from "@/lib/api/errors";
import { z } from "zod";

const coffeeChatSchema = z.object({
  contact_id:      z.string().uuid().optional().nullable(),
  scheduled_at:    z.string().datetime({ message: "Invalid datetime format" }),
  medium:          z.enum(["Zoom", "Phone", "In-person", "Google Meet", "Teams"]).default("Zoom"),
  status:          z.enum(["Scheduled", "Completed", "Cancelled", "No-show"]).default("Scheduled"),
  agenda:          z.string().max(2000).optional().nullable(),
  notes:           z.string().max(5000).optional().nullable(),
  follow_up_sent:  z.boolean().default(false),
  referral_outcome: z.string().max(500).optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const rl = await checkRateLimit(`networking:chats:get:${user.id}`, { maxRequests: 60, windowMs: 60_000 });
    if (!rl.allowed) throw ApiError.tooManyRequests("Too many requests.");

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    let query = supabase
      .from("coffee_chats")
      .select("*, contact:contacts(name, title, company)")
      .eq("user_id", user.id)
      .order("scheduled_at", { ascending: true });

    if (status && status !== "all") query = query.eq("status", status);

    const { data, error } = await query;
    if (error) throw ApiError.internal("Failed to fetch coffee chats.");

    return successResponse({ chats: data ?? [] });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin.");

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const rl = await checkRateLimit(`networking:chats:post:${user.id}`, { maxRequests: 30, windowMs: 60_000 });
    if (!rl.allowed) throw ApiError.tooManyRequests("Too many requests.");

    const body = await request.json();
    const parsed = coffeeChatSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid input";
      throw ApiError.badRequest(msg);
    }

    const { data: chat, error: chatError } = await supabase
      .from("coffee_chats")
      .insert({ ...parsed.data, user_id: user.id })
      .select("*, contact:contacts(name, title, company)")
      .single();

    if (chatError || !chat) throw ApiError.internal("Failed to create coffee chat.");

    // Auto-create a reminder 1 hour before the scheduled time (non-fatal)
    const scheduledMs = new Date(parsed.data.scheduled_at).getTime();
    if (scheduledMs > Date.now()) {
      const remindAt = new Date(scheduledMs - 60 * 60 * 1000).toISOString();
      const contactName = (chat.contact as { name?: string } | null)?.name ?? "your contact";
      const admin = createAdminClient();
      await admin.from("reminders").insert({
        user_id:      user.id,
        type:         "Custom",
        title:        `Coffee chat with ${contactName}`,
        description:  parsed.data.agenda ?? null,
        remind_at:    remindAt,
        is_completed: false,
      }).then(({ error }) => {
        if (error) console.error("[coffee-chats] reminder insert error:", error.message);
      });
    }

    return successResponse({ chat }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
