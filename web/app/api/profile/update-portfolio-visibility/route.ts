import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError, errorResponse, validateBody } from "@/lib/api/errors";
import { verifyOrigin } from "@/lib/security/csrf";
import { z } from "zod";

const schema = z.object({
  portfolio_public: z.boolean().optional(),
  show_email: z.boolean().optional(),
});

/** POST /api/profile/update-portfolio-visibility — toggle public portfolio flag */
export async function POST(request: NextRequest) {
  try {
    if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin.");

    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw ApiError.unauthorized();

    const body = await validateBody(request, schema);

    // Require a username before making public
    if (body.portfolio_public) {
      const meta = user.user_metadata ?? {};
      if (!meta.username) {
        throw ApiError.badRequest("Set a username before making your portfolio public.");
      }
    }

    const admin = createAdminClient();
    const updates: Record<string, unknown> = {};
    if (body.portfolio_public !== undefined) updates.portfolio_public = body.portfolio_public;
    if (body.show_email !== undefined) updates.show_email = body.show_email;

    const { error: updateErr } = await admin.auth.admin.updateUserById(user.id, {
      user_metadata: { ...user.user_metadata, ...updates },
    });

    if (updateErr) throw ApiError.internal("Failed to update visibility.");
    return NextResponse.json(updates);
  } catch (e) {
    return errorResponse(e);
  }
}
