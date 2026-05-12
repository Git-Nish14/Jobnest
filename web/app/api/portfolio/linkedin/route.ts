import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError, errorResponse, validateBody } from "@/lib/api/errors";
import { verifyOrigin } from "@/lib/security/csrf";
import { z } from "zod";

const LINKEDIN_RE = /^https:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9_.%-]{3,100}\/?$/;

const linkedinSchema = z.object({
  linkedin_url: z
    .string()
    .regex(LINKEDIN_RE, "Must be a valid linkedin.com/in/... profile URL")
    .nullable()
    .optional(),
  // Self-assessed LinkedIn strength checklist
  checklist: z
    .object({
      has_photo:          z.boolean(),
      has_headline:       z.boolean(),
      has_about:          z.boolean(),
      has_featured:       z.boolean(),
      has_experience:     z.boolean(),
      has_skills:         z.boolean(),
      has_recommendations: z.boolean(),
      over_500_connections: z.boolean(),
    })
    .optional(),
});

/** GET /api/portfolio/linkedin — return stored LinkedIn data from user_metadata */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw ApiError.unauthorized();

    const meta = user.user_metadata ?? {};
    return NextResponse.json({
      linkedin_url: meta.linkedin_url ?? null,
      checklist: meta.linkedin_checklist ?? null,
    });
  } catch (e) {
    return errorResponse(e);
  }
}

/** POST /api/portfolio/linkedin — save LinkedIn URL + checklist to user_metadata */
export async function POST(request: NextRequest) {
  try {
    if (!verifyOrigin(request)) throw ApiError.forbidden("Invalid request origin.");

    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw ApiError.unauthorized();

    const body = await validateBody(request, linkedinSchema);

    const admin = createAdminClient();
    const { error: updateErr } = await admin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...user.user_metadata,
        linkedin_url: body.linkedin_url ?? null,
        linkedin_checklist: body.checklist ?? null,
      },
    });

    if (updateErr) throw ApiError.internal("Failed to save LinkedIn data.");

    return NextResponse.json({
      linkedin_url: body.linkedin_url ?? null,
      checklist: body.checklist ?? null,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
