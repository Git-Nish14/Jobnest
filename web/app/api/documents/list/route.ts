import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getSignedUrls } from "@/lib/utils/storage";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const rl = checkRateLimit(`doc-list:${user.id}`, { maxRequests: 120, windowMs: 60_000 });
    if (!rl.allowed) throw ApiError.tooManyRequests("Too many requests.");

    const { searchParams } = new URL(request.url);
    const applicationId     = searchParams.get("application_id");
    const includeVersions   = searchParams.get("include_versions") === "true";
    const isMasterOnly      = searchParams.get("master") === "true";
    const labelFilter       = searchParams.get("label");

    let query = supabase
      .from("application_documents")
      .select("*")
      .eq("user_id", user.id)
      .order("uploaded_at", { ascending: false });

    if (isMasterOnly) {
      query = query.is("application_id", null).eq("is_master", true);
    } else if (applicationId) {
      // Verify the application belongs to this user
      const { data: app } = await supabase
        .from("job_applications")
        .select("id")
        .eq("id", applicationId)
        .eq("user_id", user.id)
        .single();
      if (!app) throw ApiError.forbidden("Application not found or access denied.");

      query = query.eq("application_id", applicationId);
    }

    if (labelFilter) {
      query = query.eq("label", labelFilter);
    }

    if (!includeVersions) {
      query = query.eq("is_current", true);
    }

    const { data: docs, error } = await query;
    if (error) throw ApiError.internal("Failed to fetch documents.");

    // Attach signed URLs in a single batch request
    const paths = (docs ?? []).map((d) => d.storage_path);
    const urlMap = paths.length > 0 ? await getSignedUrls(supabase, paths) : {};

    const documents = (docs ?? []).map((d) => ({
      ...d,
      signed_url: urlMap[d.storage_path] ?? null,
    }));

    return NextResponse.json({ documents });
  } catch (error) {
    return errorResponse(error);
  }
}
