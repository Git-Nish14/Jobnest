import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ApiError, errorResponse } from "@/lib/api/errors";

// In-process CoL cache: city slug → { index, ts }
// Teleport API is free, no key required, but we cache to avoid hammering.
const cache = new Map<string, { index: number; ts: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function slugify(city: string): string {
  return city
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function fetchCoLIndex(citySlug: string): Promise<number | null> {
  const cached = cache.get(citySlug);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.index;
  }

  try {
    const url = `https://api.teleport.org/api/urban_areas/slug:${encodeURIComponent(citySlug)}/scores/`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return null;

    const json = await res.json();
    // Teleport returns categories array; "Cost of Living" is one category
    const categories: Array<{ name: string; score_out_of_10: number }> =
      json?.categories ?? [];
    const colCategory = categories.find(
      (c) => c.name === "Cost of Living"
    );
    if (!colCategory) return null;

    // Teleport scores 0–10; higher = more affordable (inverse of cost).
    // We convert to an index relative to baseline (score 5 → index 1.0).
    // Lower score = higher cost = index > 1; higher score = lower cost = index < 1.
    const affordabilityScore = colCategory.score_out_of_10;
    const index = parseFloat(((5 / Math.max(affordabilityScore, 0.1)) * 0.6 + 0.4).toFixed(3));

    cache.set(citySlug, { index, ts: Date.now() });
    return index;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw ApiError.unauthorized();

    const city = request.nextUrl.searchParams.get("city");
    if (!city || city.trim().length < 2) {
      return NextResponse.json({ error: "city parameter required" }, { status: 400 });
    }

    const slug  = slugify(city.trim());
    const index = await fetchCoLIndex(slug);

    return NextResponse.json({
      city: city.trim(),
      slug,
      col_index: index ?? 1.0,
      supported: index !== null,
      note: index === null
        ? "City not found in Teleport database — using neutral index 1.0"
        : undefined,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
