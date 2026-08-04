import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyOrigin } from "@/lib/security/csrf";
import { ApiError, errorResponse, successResponse } from "@/lib/api/errors";
import { OUTREACH_STATUSES } from "@/types/networking";
import { z } from "zod";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const outreachSchema = z.object({
  outreach_status: z.enum(OUTREACH_STATUSES),
});

interface Params { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin.");

    const { id } = await params;
    if (!UUID_RE.test(id)) throw ApiError.badRequest("Invalid contact ID.");

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const rl = await checkRateLimit(`networking:outreach:patch:${user.id}`, { maxRequests: 30, windowMs: 60_000 });
    if (!rl.allowed) throw ApiError.tooManyRequests("Too many requests.");

    const body = await request.json();
    const parsed = outreachSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid outreach status";
      throw ApiError.badRequest(msg);
    }

    // Only stamp last_contacted_at when actually making contact.
    // Resetting to "Not Contacted" clears the timestamp so the weekly counter
    // and suggested-contacts logic don't count this person as reached out to.
    const last_contacted_at = parsed.data.outreach_status === "Not Contacted"
      ? null
      : new Date().toISOString();

    const { data, error } = await supabase
      .from("contacts")
      .update({ outreach_status: parsed.data.outreach_status, last_contacted_at })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error || !data) throw ApiError.notFound("Contact not found.");

    return successResponse({ contact: data });
  } catch (error) {
    return errorResponse(error);
  }
}
