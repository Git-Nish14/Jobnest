import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";

const MAX_RESULTS = 8;
const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 100;

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const rl = await checkRateLimit(`search:${user.id}`, { maxRequests: 30, windowMs: 60_000 });
    if (!rl.allowed) throw ApiError.tooManyRequests("Too many search requests.");

    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

    if (q.length < MIN_QUERY_LENGTH) {
      return NextResponse.json({ results: [] });
    }

    // Clamp query length — prevents absurdly long inputs from reaching the DB.
    const safeQ = q.slice(0, MAX_QUERY_LENGTH);

    // Full-text search using the GIN-indexed search_vector column.
    // websearch_to_tsquery handles quoted phrases and AND/OR operators naturally.
    // We fall back to ilike on company/position as a secondary pass for short
    // queries where websearch_to_tsquery produces an empty tsquery (e.g. "a").
    const { data: ftResults, error: ftError } = await supabase
      .from("job_applications")
      .select("id, company, position, status, applied_date")
      .textSearch("search_vector", safeQ, { type: "websearch", config: "english" })
      .eq("user_id", user.id)
      .order("applied_date", { ascending: false })
      .limit(MAX_RESULTS);

    if (ftError) {
      // Full-text search failed (e.g. migration not yet applied) — fall back to ilike
      const { data: fallback } = await supabase
        .from("job_applications")
        .select("id, company, position, status, applied_date")
        .or(`company.ilike.%${safeQ}%,position.ilike.%${safeQ}%`)
        .eq("user_id", user.id)
        .order("applied_date", { ascending: false })
        .limit(MAX_RESULTS);

      return NextResponse.json({ results: fallback ?? [] });
    }

    // If full-text returned nothing, try ilike for prefix matches.
    // This helps for partial words that don't yet match a full token.
    if (!ftResults || ftResults.length === 0) {
      const { data: fallback } = await supabase
        .from("job_applications")
        .select("id, company, position, status, applied_date")
        .or(`company.ilike.%${safeQ}%,position.ilike.%${safeQ}%`)
        .eq("user_id", user.id)
        .order("applied_date", { ascending: false })
        .limit(MAX_RESULTS);

      return NextResponse.json({ results: fallback ?? [] });
    }

    return NextResponse.json({ results: ftResults });
  } catch (error) {
    return errorResponse(error);
  }
}
